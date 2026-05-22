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

/**
 * Test whether the current page is a logged-in Instagram homepage.
 * We use a few signals: presence of nav, absence of login form, /accounts/login redirect.
 */
async function isLoggedIn(page, log) {
  // If the URL bounced to /accounts/login or /accounts/onetap then we're not logged in
  const url = page.url();
  if (url.includes('/accounts/login') || url.includes('/accounts/emailsignup')) {
    return false;
  }
  // Look for the username/password fields — if present we are NOT logged in
  const loginForm = await safeWaitForSelector(page, 'input[name="username"]', { timeout: 3000 });
  if (loginForm) return false;
  // Otherwise look for the home feed nav indicators
  const navHome = await page.locator('a[href="/"]').first().isVisible({ timeout: 2000 }).catch(() => false);
  const svgHome = await page.locator('svg[aria-label="Home"]').first().isVisible({ timeout: 2000 }).catch(() => false);
  return navHome || svgHome;
}

/**
 * Dismiss common interstitials shown after login or on first load:
 *  - "Save your login info?"  → "Not now"
 *  - "Turn on notifications?" → "Not Now"
 *  - Cookie banner            → "Allow all" or "Decline"
 */
async function dismissDialogs(page, log) {
  for (let i = 0; i < 4; i++) {
    const clicked = await clickByText(page, [
      'Not now',
      'Not Now',
      'Save info', // sometimes Instagram inverts the prompt
      'Cancel',
    ], 2000);
    if (!clicked) break;
    await humanDelay(400, 900);
  }
  // Cookie banner (EU) is one of these; clicking either dismisses it
  await clickByText(page, ['Allow all cookies', 'Only allow essential cookies', 'Decline optional cookies'], 1500).catch(() => {});
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

  // We're not logged in; navigate to the login page explicitly
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

  // Quick pre-check for an obvious block
  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    log.warn(`block signal on login page for ${username}`);
    return { ok: false, blocked: true, reason: 'block_signal_on_login_page' };
  }

  // ─── Fill credentials ───
  const userField = await safeWaitForSelector(page, 'input[name="username"]', { timeout: 15000 });
  if (!userField) {
    return { ok: false, reason: 'username_input_not_found' };
  }
  await userField.click();
  await humanDelay();
  await humanType(userField, username);

  const passField = page.locator('input[name="password"]').first();
  await passField.click();
  await humanDelay();
  await humanType(passField, password);
  await humanDelay(200, 500);

  // Submit. Pressing Enter is more natural than clicking a button.
  await passField.press('Enter');

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
    // Maybe the page is slow — re-check login state once more
    await sleep(2000);
    if (await isLoggedIn(page, log)) return { ok: true };
    return { ok: false, reason: 'unknown_state_after_login' };
  }

  // Block signals
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

    // Find the actual input (may be one of several selectors)
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

    // Submit — try confirm button, fallback to Enter
    const confirmed = await clickByText(page, ['Confirm', 'Submit', 'Verify', 'Next'], 2500);
    if (!confirmed) {
      await codeInput.locator.press('Enter');
    }

    // Wait for either home, another challenge, or block
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
    // else — we landed on the home feed; dismiss any remaining dialogs
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
