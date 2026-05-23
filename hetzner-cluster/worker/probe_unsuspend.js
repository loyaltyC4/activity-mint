/**
 * Unsuspend probe — try to clear Instagram's "Confirm you're human to use
 * your account" wall using CloakBrowser's humanize=true behavioral patches.
 *
 * Flow:
 *   1. Launch CloakBrowser with humanize=true + proxy + clean profile dir.
 *   2. Navigate to instagram.com → click Log in → fill credentials + submit.
 *   3. IG should redirect a flagged account to /accounts/suspended/ which
 *      shows a "Confirm you're human ... Continue ... Takes about 30 seconds"
 *      page.
 *   4. Click Continue with the humanize-driven mouse curve.
 *   5. Wait ~40s for IG to process the behavioral check.
 *   6. Classify outcome: unsuspended, still suspended, CAPTCHA, etc.
 *
 * All artifacts go to /app/profile so the workflow action can copy them out.
 *
 * Required env vars (workflow injects from secrets):
 *   IG_USERNAME, IG_PASSWORD, IG_2FA_SECRET (optional)
 *   PROXY_HOST, PROXY_USER, PROXY_PASS, PROXY_HTTP_PORT
 */
'use strict';

const fs = require('fs');

const IG_USERNAME = process.env.IG_USERNAME || '';
const IG_PASSWORD = process.env.IG_PASSWORD || '';
const PROXY_HOST  = process.env.PROXY_HOST  || '';
const PROXY_USER  = process.env.PROXY_USER  || '';
const PROXY_PASS  = process.env.PROXY_PASS  || '';
const PROXY_PORT  = process.env.PROXY_HTTP_PORT || '50100';
const PROFILE_DIR = '/app/profile';

if (!IG_USERNAME || !IG_PASSWORD) {
  console.error('[unsuspend] missing IG_USERNAME or IG_PASSWORD');
  process.exit(64);
}

async function snap(page, tag) {
  try {
    await page.screenshot({ path: `${PROFILE_DIR}/last_unsuspend_${tag}.png`, fullPage: false });
    const html = await page.content();
    if (html) fs.writeFileSync(`${PROFILE_DIR}/last_unsuspend_${tag}.html`, html);
  } catch (_) {}
}

async function isLoggedInHome(page) {
  const url = page.url();
  if (/\/accounts\/(login|suspended|disabled|signup)\//.test(url)) return false;
  try {
    const home = await page.locator('svg[aria-label="Home"], a[href="/"]').first().isVisible({ timeout: 1500 });
    return home;
  } catch (_) { return false; }
}

(async () => {
  const cb = await import('cloakbrowser');
  const proxy = PROXY_HOST ? `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}` : undefined;
  console.log(`[unsuspend] launching CloakBrowser proxy=${PROXY_HOST}:${PROXY_PORT} humanize=true`);

  const ctx = await cb.launchPersistentContext({
    userDataDir: PROFILE_DIR,
    headless: true,
    proxy,
    geoip: true,
    humanize: true,  // KEY: Bezier mouse curves + realistic timing for the Continue click
    viewport: { width: 1366, height: 800 },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  ctx.setDefaultTimeout(20000);
  ctx.setDefaultNavigationTimeout(30000);

  const page = (await ctx.pages())[0] || await ctx.newPage();

  // ─── Step 1: Land on instagram.com so we have a session ─────────────────
  console.log('[unsuspend] navigating to instagram.com');
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) { console.warn(`[unsuspend] goto home err: ${e.message}`); }
  await page.waitForTimeout(3500);
  await snap(page, '01_home');
  console.log(`[unsuspend] after home goto: url=${page.url()}`);

  // ─── Step 2: If already on suspension page, skip login ──────────────────
  let url = page.url();
  if (!/\/accounts\/suspended\//.test(url)) {
    // Not yet on suspension page — need to login first so IG knows who we are
    // and redirects us to the suspension flow.

    // Click the inline Log in trigger if present (homepage modal flow)
    const triggers = [
      page.getByRole('button', { name: /^\s*log\s*in\s*$/i }).first(),
      page.getByRole('link',   { name: /^\s*log\s*in\s*$/i }).first(),
      page.locator('a[href="/accounts/login/"]').first(),
    ];
    let triggered = false;
    for (const t of triggers) {
      if (await t.isVisible({ timeout: 1500 }).catch(() => false)) {
        await t.click({ timeout: 3000 }).catch(() => {});
        triggered = true;
        console.log('[unsuspend] clicked inline Log in trigger');
        break;
      }
    }
    if (!triggered) {
      console.log('[unsuspend] no trigger found, going direct to /accounts/login/');
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
    await page.waitForTimeout(3000);

    // Fill username
    const userSelectors = [
      'input[name="email"]',
      'input[name="username"]',
      'input[autocomplete="username webauthn"]',
      'input[autocomplete="username"]',
    ];
    let userLoc = null;
    for (const sel of userSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) { userLoc = loc; break; }
    }
    if (!userLoc) {
      // Maybe IG already redirected us to suspended before we even saw the form
      url = page.url();
      if (/\/accounts\/suspended\//.test(url)) {
        console.log('[unsuspend] redirected to suspended page before login form appeared');
      } else {
        console.log(`[unsuspend] no username input found. url=${url}`);
        await snap(page, '02_nouser');
        console.log('OUTCOME: no_login_form');
        await ctx.close(); process.exit(0);
      }
    } else {
      await userLoc.click();
      await page.waitForTimeout(400);
      await userLoc.fill(IG_USERNAME);
      await page.waitForTimeout(600);

      const passLoc = page.locator('input[type="password"]').first();
      if (!(await passLoc.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('[unsuspend] password input not found');
        await snap(page, '02_nopass');
        console.log('OUTCOME: no_password_input');
        await ctx.close(); process.exit(0);
      }
      await passLoc.click();
      await page.waitForTimeout(400);
      await passLoc.fill(IG_PASSWORD);
      await page.waitForTimeout(800);
      console.log('[unsuspend] submitting login');
      await passLoc.press('Enter');
      await page.waitForTimeout(10000);
    }

    url = page.url();
    console.log(`[unsuspend] post-login url=${url}`);
    await snap(page, '03_post_login');
  } else {
    console.log('[unsuspend] already on suspension page from initial nav (cookies present)');
  }

  // ─── Step 3: Verify we're on the suspension page ────────────────────────
  url = page.url();
  const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (!/\/accounts\/(suspended|disabled)\//.test(url) &&
      !/confirm you'?re human|account has been (suspended|disabled)/i.test(body)) {
    console.log(`[unsuspend] not on suspension/disabled page. url=${url}`);
    console.log(`[unsuspend] body snippet: ${body.replace(/\s+/g,' ').slice(0, 300)}`);
    if (await isLoggedInHome(page)) {
      console.log('OUTCOME: already_logged_in_no_suspension');
    } else if (/incorrect|password.{0,20}wrong/i.test(body)) {
      console.log('OUTCOME: credentials_rejected_pre_suspension');
    } else {
      console.log('OUTCOME: unexpected_state');
    }
    await ctx.close(); process.exit(0);
  }
  console.log('[unsuspend] confirmed on suspension/disabled page');

  // ─── Step 4: Find and humanize-click the Continue button ────────────────
  const continueSelectors = [
    'div[role="button"]:has-text("Continue")',
    'button:has-text("Continue")',
    '[role="button"]:has-text("Continue")',
    'div[aria-label="Continue"]',
    'button[aria-label="Continue"]',
    'a:has-text("Continue")',
  ];
  let continueLoc = null;
  let continueSel = null;
  for (const sel of continueSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
      continueLoc = loc;
      continueSel = sel;
      break;
    }
  }
  if (!continueLoc) {
    console.log('[unsuspend] Continue button NOT found');
    await snap(page, '04_no_continue');
    console.log(`[unsuspend] body snippet: ${body.replace(/\s+/g,' ').slice(0, 400)}`);
    console.log('OUTCOME: no_continue_button');
    await ctx.close(); process.exit(0);
  }
  console.log(`[unsuspend] Continue button found via ${continueSel} — clicking with humanize=true`);

  // Hover first to feed natural mouse-movement signal to IG's behavioral check
  try { await continueLoc.hover({ timeout: 3000 }); } catch (_) {}
  await page.waitForTimeout(700 + Math.floor(Math.random() * 800));
  await continueLoc.click({ timeout: 5000 });
  console.log('[unsuspend] Continue clicked, waiting 40s for IG to process');
  await snap(page, '05_just_after_click');

  // ─── Step 5: Long wait for IG's behavioral check ────────────────────────
  // Page says "Takes about 30 seconds" so 40s is comfortable headroom.
  // Poll URL during the wait so we can capture early redirects.
  const waitStart = Date.now();
  let lastUrl = page.url();
  while (Date.now() - waitStart < 40000) {
    await page.waitForTimeout(2500);
    const u = page.url();
    if (u !== lastUrl) {
      console.log(`[unsuspend] url changed during wait: ${lastUrl} -> ${u}`);
      lastUrl = u;
    }
  }

  url = page.url();
  const finalBody = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  console.log(`[unsuspend] after wait: url=${url}`);
  console.log(`[unsuspend] body snippet: ${finalBody.replace(/\s+/g,' ').slice(0, 500)}`);
  await snap(page, '06_after_wait');

  // ─── Step 6: Classify outcome ───────────────────────────────────────────
  let state;
  if (await isLoggedInHome(page)) {
    state = 'unsuspended_logged_in';
  } else if (/\/accounts\/suspended\//.test(url)) {
    if (/please try again|incorrect|wasn'?t (us|able)/i.test(finalBody)) {
      state = 'humanize_check_failed';
    } else {
      state = 'still_on_suspension';
    }
  } else if (/\/accounts\/disabled\//.test(url)) {
    state = 'account_disabled_permanent';
  } else if (/\/challenge\//.test(url) || /verification|verify your identity|6-digit|enter the code/i.test(finalBody)) {
    state = 'additional_verification_required';
  } else if (/captcha|puzzle/i.test(finalBody)) {
    state = 'captcha_required';
  } else if (/\/accounts\/login\//.test(url)) {
    state = 'kicked_back_to_login';
  } else {
    state = 'unknown';
  }

  console.log(`OUTCOME: ${state}`);
  await ctx.close();
  process.exit(0);
})().catch((err) => {
  console.error(`[unsuspend] FATAL: ${err.message}\n${err.stack || ''}`);
  process.exit(1);
});
