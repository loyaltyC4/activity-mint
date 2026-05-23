/**
 * Instagram login flow with TOTP 2FA support.
 *
 * Returns one of:
 *   { ok: true }                        — logged in (or already logged in)
 *   { ok: false, blocked: true, reason } — suspicious login / captcha / challenge
 *   { ok: false, reason }                — soft failure (selector missing, etc.)
 *
 * NEVER logs the password or TOTP secret. Logs username only.
 */

'use strict';

const { authenticator } = require('otplib');
const {
  humanDelay,
  humanType,
  safeWaitForSelector,
  raceSelectors,
  clickByText,
  isBlockedSignal,
  sleep,
} = require('./utils');
const { detectLoginState, STATES } = require('./detectLoginState');

const IG_HOME = 'https://www.instagram.com/';

// Instagram has migrated the login form field names over time:
//   - 2023 → name="username" / name="password"
//   - 2026 → name="email"    / name="pass"   (current as of May 2026)
// We probe both so the worker survives the next migration too.
const USERNAME_SELECTORS = [
  'input[name="email"]',                                  // current 2026
  'input[name="username"]',                               // legacy
  'input[aria-label="Phone number, username, or email"]', // older variant
  'input[aria-label*="username" i]',
  'input[aria-label*="email" i]',
  'input[type="text"][autocomplete*="username" i]',
];
const PASSWORD_SELECTORS = [
  'input[name="pass"]',                                   // current 2026
  'input[name="password"]',                               // legacy
  'input[type="password"]',                               // last resort
];

/**
 * Test whether the current page is a logged-in Instagram homepage.
 */
async function isLoggedIn(page, log) {
  const url = page.url();
  if (url.includes('/accounts/login') || url.includes('/accounts/emailsignup')) {
    return false;
  }
  // Look for either of the username inputs — if present we are NOT logged in
  for (const sel of USERNAME_SELECTORS) {
    const found = await safeWaitForSelector(page, sel, { timeout: 1500 });
    if (found) return false;
  }
  // Otherwise look for the home feed nav indicators
  const navHome = await page.locator('a[href="/"]').first().isVisible({ timeout: 2000 }).catch(() => false);
  const svgHome = await page.locator('svg[aria-label="Home"]').first().isVisible({ timeout: 2000 }).catch(() => false);
  return navHome || svgHome;
}

/**
 * Dismiss common interstitials shown after login or on first load.
 */
async function dismissDialogs(page, log) {
  const cookieLabels = [
    'Allow all cookies',
    'Accept all',
    'Allow essential and optional cookies',
    'Only allow essential cookies',
    'Decline optional cookies',
    'Decline',
    'Reject',
    'Accept',
  ];
  for (let i = 0; i < 3; i++) {
    const clicked = await clickByText(page, cookieLabels, 1500);
    if (!clicked) break;
    await humanDelay(400, 800);
  }

  for (let i = 0; i < 4; i++) {
    const clicked = await clickByText(page, [
      'Not now',
      'Not Now',
      'Save info',
      'Cancel',
      'Maybe later',
    ], 2000);
    if (!clicked) break;
    await humanDelay(400, 900);
  }
}

async function findUserField(page, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of USERNAME_SELECTORS) {
      const loc = await safeWaitForSelector(page, sel, { timeout: 800 });
      if (loc) return { selector: sel, locator: loc };
    }
    await sleep(250);
  }
  return null;
}

/**
 * Try to open the login modal from the homepage WITHOUT navigating to
 * /accounts/login/. Instagram rate-limits /accounts/login/ on a per-IP
 * basis at the CDN edge — but instagram.com/ stays accessible. Many
 * residential IPs that 429 on /accounts/login/ will let you reach the
 * homepage and submit credentials via the modal.
 *
 * Returns true if a login form is now visible (either was already inline
 * or we successfully opened the modal), false otherwise.
 */
async function openLoginModalFromHome(page, log) {
  // 1. If the homepage already has an inline form (some logged-out variants do), we're done.
  for (const sel of USERNAME_SELECTORS) {
    const visible = await page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) {
      log.info(`homepage has inline login form (${sel})`);
      return true;
    }
  }

  // 2. Look for a "Log in" trigger (button or link) — click it to open the modal.
  const triggerCandidates = [
    page.getByRole('button', { name: /^\s*log\s*in\s*$/i }).first(),
    page.getByRole('link',   { name: /^\s*log\s*in\s*$/i }).first(),
    page.locator('a[href="/accounts/login/"]').first(),
    page.locator('button:has-text("Log in")').first(),
    page.locator('button:has-text("Log In")').first(),
  ];
  for (let i = 0; i < triggerCandidates.length; i++) {
    const cand = triggerCandidates[i];
    try {
      const visible = await cand.isVisible({ timeout: 1500 }).catch(() => false);
      if (!visible) continue;
      log.info(`clicking login trigger #${i}`);
      await cand.click({ timeout: 3000 });
      // Wait for either the form to appear OR a navigation (could be redirect to /accounts/login/)
      const start = Date.now();
      while (Date.now() - start < 10000) {
        for (const sel of USERNAME_SELECTORS) {
          const found = await page.locator(sel).first().isVisible({ timeout: 500 }).catch(() => false);
          if (found) {
            log.info(`login form now visible after trigger #${i} (selector ${sel})`);
            return true;
          }
        }
        await sleep(300);
      }
    } catch (err) {
      log.warn(`login trigger #${i} click failed: ${err.message}`);
    }
  }
  return false;
}

async function findPassField(page, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const sel of PASSWORD_SELECTORS) {
      const loc = await safeWaitForSelector(page, sel, { timeout: 600 });
      if (loc) return { selector: sel, locator: loc };
    }
    await sleep(200);
  }
  return null;
}

// ── 2FA input selectors (tracked here so captureSnap knows where to look) ──
const TWO_FA_SELECTORS = [
  'input[name="verificationCode"]',
  'input[aria-label*="security code" i]',
  'input[aria-label*="confirmation code" i]',
  'input[autocomplete="one-time-code"]',
];

const HOME_NAV_SELECTORS = ['svg[aria-label="Home"]', 'a[href="/"]'];

/**
 * Capture a snapshot of the current page state for detectLoginState().
 * Cheap selector probes (each ≤300ms) so the whole capture is well under 2s.
 */
async function captureSnap(page) {
  const url = page.url();
  const bodyText = await page.locator('body').innerText({ timeout: 1500 }).catch(() => '');
  async function anyVisible(selectors) {
    for (const sel of selectors) {
      const v = await page.locator(sel).first().isVisible({ timeout: 300 }).catch(() => false);
      if (v) return true;
    }
    return false;
  }
  const [hasUserField, hasPassField, has2faField, hasHomeNav] = await Promise.all([
    anyVisible(USERNAME_SELECTORS),
    anyVisible(PASSWORD_SELECTORS),
    anyVisible(TWO_FA_SELECTORS),
    anyVisible(HOME_NAV_SELECTORS),
  ]);
  return { url, bodyText, hasUserField, hasPassField, has2faField, hasHomeNav };
}

/**
 * Poll the page state until detectLoginState returns a TERMINAL state, or we
 * time out. LOGIN_FORM is treated as transient during the wait window (the
 * form is briefly visible just after submit while IG processes credentials)
 * and only counts as final if the poll times out without seeing anything else.
 */
async function waitForLoginState(page, timeoutMs = 20000) {
  const start = Date.now();
  let lastSnap = null;
  while (Date.now() - start < timeoutMs) {
    lastSnap = await captureSnap(page);
    const state = detectLoginState(lastSnap);
    // Terminal states: anything that's not UNKNOWN and not the still-here login form
    if (state !== STATES.UNKNOWN && state !== STATES.LOGIN_FORM) {
      return { state, snap: lastSnap };
    }
    await sleep(500);
  }
  // Timeout: surface whatever the final state is (may be LOGIN_FORM = stuck, may be UNKNOWN)
  const finalSnap = lastSnap || (await captureSnap(page));
  return { state: detectLoginState(finalSnap), snap: finalSnap };
}

async function captureFailureDump(page, log, tag) {
  try {
    await page.screenshot({ path: `/app/profile/last_${tag}_failure.png`, fullPage: false }).catch(() => {});
    const html = await page.content().catch(() => '');
    if (html) require('fs').writeFileSync(`/app/profile/last_${tag}_failure.html`, html);
  } catch (err) {
    log.warn(`captureFailureDump ${tag} failed: ${err.message}`);
  }
}

/**
 * Main login routine. Idempotent — safe to call even if we're already logged in.
 */
async function ensureLoggedIn(page, creds, log) {
  const { username, password, totpSecret } = creds;

  log.info(`navigating to instagram.com (user=${username})`);
  try {
    await page.goto(IG_HOME, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    log.warn(`initial goto failed: ${err.message}`);
  }

  await humanDelay(800, 1600);
  await dismissDialogs(page, log);

  if (await isLoggedIn(page, log)) {
    log.info(`already logged in as ${username}`);
    return { ok: true };
  }

  log.info(`not logged in — trying modal-based login flow (avoid /accounts/login/) for ${username}`);

  // ─── Try modal-based login first ───────────────────────────────────────
  // We are still on the homepage from the initial goto above. Try to find
  // an inline login form OR click a "Log in" trigger to open the modal.
  // If this works, we never touch /accounts/login/ and bypass the IP-level
  // rate limit that's hitting some residential proxies.
  let modalOpened = await openLoginModalFromHome(page, log);

  // If modal-from-home failed, fall back to /accounts/login/ (older flow).
  if (!modalOpened) {
    log.info(`modal flow didn't find a form — falling back to /accounts/login/`);
    try {
      await page.goto('https://www.instagram.com/accounts/login/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (err) {
      log.warn(`login page goto failed: ${err.message}`);
    }
    await humanDelay(800, 1500);
    await dismissDialogs(page, log);
  } else {
    log.info(`modal-based login form visible — skipping /accounts/login/`);
    await humanDelay(400, 900);
  }

  // Quick pre-check for an obvious block / proxy 429
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (isBlockedSignal(bodyText) || /HTTP ERROR 429|page isn’t working|page isn't working/i.test(bodyText)) {
    log.warn(`block signal on login page for ${username}: ${bodyText.slice(0, 120)}`);
    return { ok: false, blocked: true, reason: 'block_signal_on_login_page' };
  }

  // ─── Find username field (multi-selector race) ───
  const userFound = await findUserField(page, 10000);
  if (!userFound) {
    const url = page.url();
    const title = await page.title().catch(() => '');
    const snippet = (bodyText || '').replace(/\s+/g, ' ').slice(0, 800);
    log.warn(`username field not found. url=${url}`);
    log.warn(`page title: ${title}`);
    log.warn(`body snippet: ${snippet}`);
    try {
      await page.screenshot({ path: `/app/profile/last_login_failure.png`, fullPage: false });
      log.warn(`screenshot saved to /app/profile/last_login_failure.png`);
    } catch (err) {
      log.warn(`screenshot failed: ${err.message}`);
    }
    try {
      const fs = require('fs');
      const html = await page.content();
      fs.writeFileSync(`/app/profile/last_login_failure.html`, html);
      log.warn(`html dump saved to /app/profile/last_login_failure.html`);
    } catch (err) {
      log.warn(`html dump failed: ${err.message}`);
    }
    return { ok: false, reason: 'username_input_not_found' };
  }
  log.info(`username field matched selector: ${userFound.selector}`);
  await userFound.locator.click();
  await humanDelay();
  // Use locator.fill() — single-shot, atomic. Avoids the race that scrambles
  // characters when humanize wrapping happens per .type(ch) call.
  await userFound.locator.fill(username);
  await humanDelay(150, 400);

  // ─── Find password field ───
  const passFound = await findPassField(page, 5000);
  if (!passFound) {
    log.warn(`password field not found for ${username}`);
    return { ok: false, reason: 'password_input_not_found' };
  }
  log.info(`password field matched selector: ${passFound.selector}`);
  await passFound.locator.click();
  await humanDelay();
  await passFound.locator.fill(password);
  await humanDelay(200, 500);

  // Submit. Pressing Enter is more natural than clicking a button.
  await passFound.locator.press('Enter');

  // ─── Post-submit classification via detectLoginState (pure, unit-tested) ──
  // One state machine handles every IG outcome: home, 2fa, challenge,
  // incorrect credentials, rate-limit, login-form-redisplayed, unknown.
  const { state, snap } = await waitForLoginState(page, 20000);
  log.info(`post-submit state=${state} url=${snap.url}`);

  if (state === STATES.HOME) {
    await humanDelay(500, 1200);
    await dismissDialogs(page, log);
    if (await isLoggedIn(page, log)) {
      log.info(`login succeeded for ${username}`);
      return { ok: true };
    }
    log.warn(`detected HOME state but isLoggedIn re-check failed`);
  }

  if (state === STATES.RATE_LIMITED) {
    log.warn(`rate-limited post-submit for ${username}`);
    return { ok: false, blocked: true, reason: 'rate_limited_during_submit' };
  }

  if (state === STATES.CHALLENGE) {
    log.warn(`challenge / suspicious-login wall for ${username}`);
    return { ok: false, blocked: true, reason: 'challenge_or_suspicious_login' };
  }

  if (state === STATES.INCORRECT_CREDENTIALS) {
    log.warn(`credentials rejected for ${username} (locked / geo-mismatch / password changed)`);
    await captureFailureDump(page, log, 'credentials_rejected');
    return { ok: false, reason: 'credentials_rejected' };
  }

  if (state === STATES.TWO_FACTOR) {
    if (!totpSecret) {
      log.warn(`2FA required for ${username} but no IG_2FA_SECRET set`);
      return { ok: false, reason: '2fa_required_but_no_secret' };
    }
    log.info(`2FA prompt for ${username} — generating TOTP`);
    let code;
    try {
      code = authenticator.generate(totpSecret);
    } catch (err) {
      log.warn(`otplib failed to generate code: ${err.message}`);
      return { ok: false, reason: 'totp_generation_failed' };
    }

    const codeInput = await raceSelectors(page, TWO_FA_SELECTORS, 5000);
    if (!codeInput) return { ok: false, reason: '2fa_input_disappeared' };
    await codeInput.locator.click();
    await humanDelay();
    await codeInput.locator.fill(code);
    await humanDelay(200, 500);

    const confirmed = await clickByText(page, ['Confirm', 'Submit', 'Verify', 'Next'], 2500);
    if (!confirmed) await codeInput.locator.press('Enter');

    const post2fa = await waitForLoginState(page, 20000);
    log.info(`post-2fa state=${post2fa.state}`);

    if (post2fa.state === STATES.HOME) {
      await humanDelay(500, 1200);
      await dismissDialogs(page, log);
      if (await isLoggedIn(page, log)) {
        log.info(`login succeeded (with 2FA) for ${username}`);
        return { ok: true };
      }
    }
    if (post2fa.state === STATES.CHALLENGE) return { ok: false, blocked: true, reason: 'challenge_after_2fa' };
    if (post2fa.state === STATES.RATE_LIMITED) return { ok: false, blocked: true, reason: 'rate_limited_after_2fa' };
    if (post2fa.state === STATES.INCORRECT_CREDENTIALS) {
      log.warn(`incorrect 2FA code for ${username} (clock drift?)`);
      return { ok: false, reason: 'incorrect_2fa_code' };
    }
    return { ok: false, reason: `not_logged_in_after_2fa:${post2fa.state}` };
  }

  // STATES.LOGIN_FORM or STATES.UNKNOWN at this point — submit appears to
  // have done nothing (form re-rendered) or IG served an unrecognised page.
  log.warn(`post-submit unrecognised: state=${state}`);
  await captureFailureDump(page, log, 'login');
  return { ok: false, reason: `unknown_state_after_login:${state}` };
}

module.exports = { ensureLoggedIn, isLoggedIn, dismissDialogs };
