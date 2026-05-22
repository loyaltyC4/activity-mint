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

  log.info(`not logged in — performing login flow for ${username}`);
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
  await humanType(userFound.locator, username);

  // ─── Find password field ───
  const passFound = await findPassField(page, 5000);
  if (!passFound) {
    log.warn(`password field not found for ${username}`);
    return { ok: false, reason: 'password_input_not_found' };
  }
  log.info(`password field matched selector: ${passFound.selector}`);
  await passFound.locator.click();
  await humanDelay();
  await humanType(passFound.locator, password);
  await humanDelay(200, 500);

  // Submit. Pressing Enter is more natural than clicking a button.
  await passFound.locator.press('Enter');

  // ─── Post-submit: 2FA, suspicious login, captcha, or success ───
  const outcome = await raceSelectors(
    page,
    [
      'input[name="verificationCode"]',
      'input[aria-label*="security code" i]',
      'input[aria-label*="confirmation code" i]',
      'input[autocomplete="one-time-code"]',
      'svg[aria-label="Home"]',
      'a[href="/"]',
      'text=/please wait a few minutes/i',
      'text=/we detected an unusual login/i',
      'text=/help us confirm/i',
      'text=/suspicious login/i',
    ],
    20000,
  );

  if (!outcome) {
    log.warn(`no recognised state after credential submit for ${username}`);
    await sleep(2000);
    if (await isLoggedIn(page, log)) return { ok: true };
    return { ok: false, reason: 'unknown_state_after_login' };
  }

  if (
    outcome.selector.includes('please wait') ||
    outcome.selector.includes('unusual login') ||
    outcome.selector.includes('help us confirm') ||
    outcome.selector.includes('suspicious login')
  ) {
    log.warn(`login blocked / challenge for ${username}: ${outcome.selector}`);
    return { ok: false, blocked: true, reason: 'challenge_or_suspicious_login' };
  }

  // 2FA prompt
  if (outcome.selector.toLowerCase().includes('verificationcode') ||
      outcome.selector.toLowerCase().includes('security code') ||
      outcome.selector.toLowerCase().includes('confirmation code') ||
      outcome.selector.toLowerCase().includes('one-time-code')) {

    if (!totpSecret) {
      log.warn(`2FA required for ${username} but no IG_2FA_SECRET set`);
      return { ok: false, reason: '2fa_required_but_no_secret' };
    }

    log.info(`2FA prompt detected for ${username} — generating TOTP`);
    let code;
    try {
      code = authenticator.generate(totpSecret);
    } catch (err) {
      log.warn(`otplib failed to generate code: ${err.message}`);
      return { ok: false, reason: 'totp_generation_failed' };
    }

    const codeInput = await raceSelectors(
      page,
      [
        'input[name="verificationCode"]',
        'input[aria-label*="security code" i]',
        'input[aria-label*="confirmation code" i]',
        'input[autocomplete="one-time-code"]',
      ],
      5000,
    );
    if (!codeInput) {
      return { ok: false, reason: '2fa_input_disappeared' };
    }
    await codeInput.locator.click();
    await humanDelay();
    await humanType(codeInput.locator, code);
    await humanDelay(200, 500);

    const confirmed = await clickByText(page, ['Confirm', 'Submit', 'Verify', 'Next'], 2500);
    if (!confirmed) {
      await codeInput.locator.press('Enter');
    }

    const post2fa = await raceSelectors(
      page,
      [
        'svg[aria-label="Home"]',
        'a[href="/"]',
        'text=/please wait a few minutes/i',
        'text=/incorrect code/i',
        'text=/we detected an unusual login/i',
        'text=/help us confirm/i',
      ],
      20000,
    );

    if (!post2fa) {
      await sleep(2000);
      if (await isLoggedIn(page, log)) return { ok: true };
      return { ok: false, reason: 'unknown_state_after_2fa' };
    }
    if (
      post2fa.selector.includes('please wait') ||
      post2fa.selector.includes('unusual login') ||
      post2fa.selector.includes('help us confirm')
    ) {
      log.warn(`blocked after 2FA for ${username}`);
      return { ok: false, blocked: true, reason: 'challenge_after_2fa' };
    }
    if (post2fa.selector.includes('incorrect code')) {
      log.warn(`incorrect 2FA code for ${username} (clock drift?)`);
      return { ok: false, reason: 'incorrect_2fa_code' };
    }
    await humanDelay(500, 1200);
    await dismissDialogs(page, log);
    if (await isLoggedIn(page, log)) {
      log.info(`login succeeded (with 2FA) for ${username}`);
      return { ok: true };
    }
    return { ok: false, reason: 'not_logged_in_after_2fa' };
  }

  // No 2FA — we should already be home
  await humanDelay(500, 1200);
  await dismissDialogs(page, log);
  if (await isLoggedIn(page, log)) {
    log.info(`login succeeded (no 2FA) for ${username}`);
    return { ok: true };
  }
  return { ok: false, reason: 'not_logged_in_after_submit' };
}

module.exports = { ensureLoggedIn, isLoggedIn, dismissDialogs };
