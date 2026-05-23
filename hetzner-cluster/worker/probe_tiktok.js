/**
 * TikTok login probe via CloakBrowser.
 *
 * One-shot test: tries to log into a TikTok account, classifies the outcome,
 * dumps screenshots + HTML to /app/profile/last_tt_*.{png,html} so we can
 * diagnose CAPTCHA / verification / rejection patterns.
 *
 * Required env vars:
 *   TT_USERNAME   - TikTok handle (e.g. "isidorauc4")
 *   TT_PASSWORD   - account password
 *   TT_EMAIL      - email tied to the account (login fallback)
 *   PROXY_HOST    - residential proxy host IP
 *   PROXY_USER    - proxy username
 *   PROXY_PASS    - proxy password
 *   PROXY_HTTP_PORT - proxy HTTP port (default 50100)
 *
 * Outcomes (printed as final line "OUTCOME: <state>"):
 *   logged_in              - on /foryou or similar logged-in URL
 *   captcha_required       - CAPTCHA puzzle visible
 *   email_verification     - asked for email verification code
 *   invalid_credentials    - explicit IG-style password rejection
 *   blocked_by_proxy       - IP-level block (Cloudflare / Akamai 403)
 *   still_on_login_page    - form re-rendered, unknown why
 *   unknown                - any other state
 */
'use strict';

const fs = require('fs');

const TT_USERNAME = process.env.TT_USERNAME || '';
const TT_PASSWORD = process.env.TT_PASSWORD || '';
const TT_EMAIL    = process.env.TT_EMAIL    || '';
const PROXY_HOST  = process.env.PROXY_HOST  || '';
const PROXY_USER  = process.env.PROXY_USER  || '';
const PROXY_PASS  = process.env.PROXY_PASS  || '';
const PROXY_PORT  = process.env.PROXY_HTTP_PORT || '50100';

if (!(TT_USERNAME || TT_EMAIL) || !TT_PASSWORD) {
  console.error('[probe] missing TT_USERNAME/TT_EMAIL or TT_PASSWORD');
  process.exit(64);
}

const PROFILE_DIR = '/app/profile';

function snap(page, tag) {
  return Promise.allSettled([
    page.screenshot({ path: `${PROFILE_DIR}/last_tt_${tag}.png`, fullPage: false }),
    page.content().then((html) => fs.writeFileSync(`${PROFILE_DIR}/last_tt_${tag}.html`, html)),
  ]).catch(() => {});
}

(async () => {
  const cb = await import('cloakbrowser');
  const proxy = PROXY_HOST ? `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}` : undefined;
  console.log(`[probe] launching CloakBrowser proxy=${PROXY_HOST}:${PROXY_PORT}`);

  const ctx = await cb.launchPersistentContext({
    userDataDir: PROFILE_DIR,
    headless: true,
    proxy,
    geoip: true,
    viewport: { width: 1366, height: 800 },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  ctx.setDefaultTimeout(15000);
  ctx.setDefaultNavigationTimeout(30000);

  const pages = await ctx.pages();
  const page = pages[0] || (await ctx.newPage());

  // Step 1 - go to TikTok email login page
  const loginUrl = 'https://www.tiktok.com/login/phone-or-email/email';
  console.log(`[probe] goto ${loginUrl}`);
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.warn(`[probe] goto error: ${e.message}`);
  }
  await page.waitForTimeout(4000);

  let url = page.url();
  let title = await page.title().catch(() => '');
  console.log(`[probe] initial url=${url} title=${title}`);
  await snap(page, 'login_initial');

  // Early failure detection
  const bodyEarly = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (/access denied|cloudflare|akamai|forbidden|blocked|403/i.test(bodyEarly)) {
    console.log(`[probe] body snippet: ${bodyEarly.slice(0, 300)}`);
    console.log(`OUTCOME: blocked_by_proxy`);
    await ctx.close(); process.exit(0);
  }

  // Step 2 - find email/username field
  const userSelectors = [
    'input[name="username"]',
    'input[name="email"]',
    'input[type="text"][autocomplete="username"]',
    'input[type="email"]',
    'input[placeholder*="Email" i]',
    'input[placeholder*="Username" i]',
    'input[type="text"]',
  ];
  let userLoc = null, userSel = null;
  for (const sel of userSelectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 1500 })) {
        userLoc = loc; userSel = sel;
        break;
      }
    } catch (_) {}
  }
  if (!userLoc) {
    console.log(`[probe] no user input found`);
    await snap(page, 'login_nouser');
    const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    console.log(`[probe] body snippet: ${body.replace(/\s+/g, ' ').slice(0, 600)}`);
    console.log(`OUTCOME: unknown`);
    await ctx.close(); process.exit(0);
  }
  console.log(`[probe] user input matched: ${userSel}`);

  // Step 3 - fill user identity (try email first then username if email empty)
  const identity = TT_EMAIL || TT_USERNAME;
  await userLoc.click();
  await page.waitForTimeout(400);
  await userLoc.fill(identity);
  await page.waitForTimeout(600);

  // Step 4 - password
  const passLoc = page.locator('input[type="password"]').first();
  if (!(await passLoc.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log(`[probe] password input not found`);
    await snap(page, 'login_nopass');
    console.log(`OUTCOME: unknown`);
    await ctx.close(); process.exit(0);
  }
  await passLoc.click();
  await page.waitForTimeout(400);
  await passLoc.fill(TT_PASSWORD);
  await page.waitForTimeout(800);

  // Step 5 - submit. Try clicking a "Log in" button first, fall back to Enter.
  let submitted = false;
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Log In")',
    'button:has-text("Login")',
    '[data-e2e="login-button"]',
  ];
  for (const sel of submitSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 2000 });
        console.log(`[probe] clicked submit via ${sel}`);
        submitted = true; break;
      }
    } catch (_) {}
  }
  if (!submitted) {
    await passLoc.press('Enter');
    console.log(`[probe] submitted via Enter key`);
  }

  // Step 6 - wait for outcome. TikTok can take 5-15s to respond.
  await page.waitForTimeout(10000);

  url = page.url();
  title = await page.title().catch(() => '');
  console.log(`[probe] post-submit url=${url} title=${title}`);
  await snap(page, 'login_after');

  const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  const bodyClean = body.replace(/\s+/g, ' ');
  console.log(`[probe] body snippet: ${bodyClean.slice(0, 600)}`);

  // Step 7 - classify
  let state = 'unknown';

  // Check for visible CAPTCHA component (TikTok's puzzle/slider)
  const captchaVisible = await page.locator('[id*="captcha" i], [class*="captcha" i], [class*="verify-captcha" i], iframe[src*="captcha"]').first().isVisible({ timeout: 1500 }).catch(() => false);

  if (/foryou|For You|following/i.test(url) && !/login/.test(url)) {
    state = 'logged_in';
  } else if (captchaVisible || /drag the puzzle|rotate the image|complete the puzzle/i.test(bodyClean)) {
    state = 'captcha_required';
  } else if (/enter verification code|verification code|6-digit code/i.test(bodyClean)) {
    state = 'email_verification';
  } else if (/access denied|forbidden|cloudflare|akamai/i.test(bodyClean)) {
    state = 'blocked_by_proxy';
  } else if (/password.{0,20}(incorrect|wrong|doesn'?t match)/i.test(bodyClean) || /invalid login/i.test(bodyClean)) {
    state = 'invalid_credentials';
  } else if (/account doesn'?t exist|no account/i.test(bodyClean)) {
    state = 'no_account';
  } else if (url.includes('/login')) {
    state = 'still_on_login_page';
  } else if (url.includes('/foryou') || url === 'https://www.tiktok.com/' || url === 'https://www.tiktok.com') {
    state = 'logged_in_likely';
  }

  console.log(`OUTCOME: ${state}`);
  await ctx.close();
  process.exit(0);
})().catch((err) => {
  console.error(`[probe] FATAL ${err.message}\n${err.stack}`);
  process.exit(1);
});
