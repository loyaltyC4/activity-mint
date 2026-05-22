/**
 * Activity Mint Worker — Express + CloakBrowser (persistent stealth Chromium profile).
 *
 * Runs ONE Instagram account behind ONE proxy IP with a persistent CloakBrowser profile.
 *
 * CloakBrowser features in use (set in launchPersistentContext options below):
 *   - geoip: true       → auto-detects timezone + locale from the proxy exit IP,
 *                         and auto-injects --fingerprint-webrtc-ip so WebRTC can't
 *                         leak the host IP through the SOCKS/HTTPS tunnel.
 *   - humanize: true    → mouse Bezier curves, per-character typing delays,
 *                         realistic scroll easing on every Playwright call.
 *   - persistent userDataDir → cookies/localStorage survive restarts (no incognito).
 *   - Source-level Chromium patches (canvas, WebGL, audio, fonts, CDP input, etc.)
 *     come built-in — no `--disable-blink-features=AutomationControlled` workaround
 *     needed; that flag was just a hint, the real signals are patched at the binary.
 *
 * Lifecycle:
 *   - On boot: launch CloakBrowser with persistent context at /app/profile, log in if needed.
 *   - On each /scrape: serialise scrape jobs (single browser, single account).
 *   - On block: set state.blocked = true; return HTTP 429 until restart.
 *   - On crash: tear down browser, recreate on next request.
 */

'use strict';

const fs = require('fs');
const express = require('express');
// cloakbrowser is an ESM-only package; load it via dynamic import() from CJS
let cloakbrowserModule = null;
async function getCloakbrowser() {
  if (!cloakbrowserModule) cloakbrowserModule = await import('cloakbrowser');
  return cloakbrowserModule;
}

// Clear any stale Chromium singleton-lock symlinks from a previous container
// shutdown that didn't release the persistent profile dir cleanly. Without
// this, the next launch fails with "profile appears to be in use by another
// Chromium process". Safe to run unconditionally on startup — this process is
// the only one that will touch the profile dir until we launch Chromium.
function clearStaleProfileLocks(dir) {
  const locks = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const f of locks) {
    try { fs.unlinkSync(`${dir}/${f}`); } catch (_) {}
  }
}
clearStaleProfileLocks('/app/profile');

const { ensureLoggedIn, isLoggedIn } = require('./scrapers/login');
const { scrapeProfile } = require('./scrapers/profile');
const { scrapeFollowers, scrapeFollowing } = require('./scrapers/followers');
const { scrapeStories } = require('./scrapers/stories');
const { isBlockedSignal } = require('./scrapers/utils');

// ─── Config from env ─────────────────────────────────────────────────────
const WORKER_ID = process.env.WORKER_ID || 'worker_unknown';
const IG_USERNAME = process.env.IG_USERNAME || '';
const IG_PASSWORD = process.env.IG_PASSWORD || '';
const IG_2FA_SECRET = process.env.IG_2FA_SECRET || '';
const PROXY_HOST = process.env.PROXY_HOST || '';
const PROXY_USER = process.env.PROXY_USER || '';
const PROXY_PASS = process.env.PROXY_PASS || '';
const PROXY_HTTP_PORT = parseInt(process.env.PROXY_HTTP_PORT || '50100', 10);
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || '';
const PORT = parseInt(process.env.PORT || '3010', 10);
const PROFILE_DIR = '/app/profile';

// ─── Logger ──────────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString();
}
const log = {
  info: (m) => process.stdout.write(`[${ts()}] [${WORKER_ID}] INFO  ${m}\n`),
  warn: (m) => process.stdout.write(`[${ts()}] [${WORKER_ID}] WARN  ${m}\n`),
  error: (m) => process.stderr.write(`[${ts()}] [${WORKER_ID}] ERROR ${m}\n`),
};

// ─── Sanity check ────────────────────────────────────────────────────────
if (!IG_USERNAME || !IG_PASSWORD) {
  log.error('IG_USERNAME / IG_PASSWORD missing — cannot start');
  process.exit(1);
}
if (!PROXY_HOST || !PROXY_USER || !PROXY_PASS) {
  log.error('proxy env vars missing — cannot start');
  process.exit(1);
}
if (!SCRAPER_SECRET) {
  log.error('SCRAPER_SECRET missing — refusing to start (would allow open access)');
  process.exit(1);
}

// ─── In-memory state ─────────────────────────────────────────────────────
const state = {
  loggedIn: false,
  lastSuccess: null,   // ISO string
  lastError: null,     // string
  requestsToday: 0,
  blocked: false,
  blockedReason: null, // string
};

let browserContext = null;        // CloakBrowser BrowserContext (persistent)
let workPage = null;              // single re-used Page
let bootPromise = null;           // promise for the in-flight boot
let lastResetDayUTC = currentUTCDay();
const jobQueue = [];              // single-flight queue
let jobInFlight = false;

function currentUTCDay() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function maybeResetCounter() {
  const day = currentUTCDay();
  if (day !== lastResetDayUTC) {
    log.info(`UTC day rolled over — resetting requestsToday from ${state.requestsToday} to 0`);
    state.requestsToday = 0;
    lastResetDayUTC = day;
  }
}
setInterval(maybeResetCounter, 60 * 1000).unref();

// ─── Browser bootstrap ───────────────────────────────────────────────────
async function bootBrowser() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_HTTP_PORT}`;
    log.info(`launching CloakBrowser (proxy=${PROXY_HOST}:${PROXY_HTTP_PORT}, profileDir=${PROFILE_DIR})`);
    try {
      const { launchPersistentContext } = await getCloakbrowser();
      const ctx = await launchPersistentContext({
        userDataDir: PROFILE_DIR,
        headless: true,
        proxy: proxyUrl,
        // CloakBrowser-specific:
        geoip: true,        // auto timezone+locale from proxy exit IP, auto WebRTC IP spoof
        // humanize is intentionally NOT enabled — when combined with per-char
        // locator.type() calls it can interleave keystrokes and scramble the
        // typed value (saw "orqyzdatby" instead of "qyzdartoby"). The login
        // flow already adds its own jitter via humanType in scrapers/utils.js,
        // which is sufficient for stealth typing on Instagram.
        // Standard Playwright options (passed straight through):
        viewport: { width: 1366, height: 800 },
        deviceScaleFactor: 1,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      // Reasonable default timeouts for all pages spawned from this context
      ctx.setDefaultTimeout(15000);
      ctx.setDefaultNavigationTimeout(30000);

      // Reuse an existing page if persistent context restored one; else open one
      let page = ctx.pages()[0];
      if (!page) page = await ctx.newPage();

      // Crash handlers
      ctx.on('close', () => {
        log.warn('browser context closed');
        browserContext = null;
        workPage = null;
        state.loggedIn = false;
      });
      page.on('crash', () => log.warn('page crashed'));

      // Attempt login (idempotent — no-op if already authed via profile)
      const result = await ensureLoggedIn(page, {
        username: IG_USERNAME,
        password: IG_PASSWORD,
        totpSecret: IG_2FA_SECRET,
      }, log);

      if (!result.ok) {
        state.loggedIn = false;
        state.lastError = `login_failed:${result.reason || 'unknown'}`;
        if (result.blocked) {
          state.blocked = true;
          state.blockedReason = result.reason || 'login_blocked';
          log.warn(`login marked us blocked — reason=${state.blockedReason}`);
        }
      } else {
        state.loggedIn = true;
        state.lastError = null;
        log.info(`logged in OK as ${IG_USERNAME}`);
      }

      browserContext = ctx;
      workPage = page;
      return { ctx, page };
    } catch (err) {
      log.error(`browser boot failed: ${err.message}`);
      state.lastError = `boot_failed:${err.message}`;
      browserContext = null;
      workPage = null;
      throw err;
    } finally {
      bootPromise = null;
    }
  })();
  return bootPromise;
}

async function ensureBrowser() {
  if (browserContext && workPage && !workPage.isClosed()) {
    return { ctx: browserContext, page: workPage };
  }
  return bootBrowser();
}

async function teardownBrowser() {
  if (!browserContext) return;
  log.info('tearing down browser context');
  try { await browserContext.close(); } catch (err) { log.warn(`ctx.close errored: ${err.message}`); }
  browserContext = null;
  workPage = null;
  state.loggedIn = false;
}

// ─── Job queue (single-flight) ───────────────────────────────────────────
async function runJob(fn) {
  return new Promise((resolve, reject) => {
    jobQueue.push({ fn, resolve, reject });
    pump();
  });
}

async function pump() {
  if (jobInFlight) return;
  const next = jobQueue.shift();
  if (!next) return;
  jobInFlight = true;
  try {
    const r = await next.fn();
    next.resolve(r);
  } catch (err) {
    next.reject(err);
  } finally {
    jobInFlight = false;
    setImmediate(pump);
  }
}

// ─── HTTP server ─────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '256kb' }));

app.use((req, _res, next) => {
  log.info(`HTTP ${req.method} ${req.path}`);
  next();
});

function requireSecret(req, res, next) {
  const sent = req.header('X-Secret');
  if (!sent || sent !== SCRAPER_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => {
  maybeResetCounter();
  res.json({
    worker_id: WORKER_ID,
    logged_in: state.loggedIn,
    last_success: state.lastSuccess,
    last_error: state.lastError,
    requests_today: state.requestsToday,
    blocked: state.blocked,
    blocked_reason: state.blockedReason,
  });
});

app.post('/scrape', requireSecret, async (req, res) => {
  maybeResetCounter();

  if (state.blocked) {
    return res.status(429).json({ ok: false, error: 'blocked', retry_after: 3600 });
  }

  const { action, payload } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ ok: false, error: 'action_required' });
  }

  try {
    const items = await runJob(async () => {
      const { page } = await ensureBrowser();

      // Confirm we're still logged in (cheap check). If not, re-login.
      if (!state.loggedIn || !(await isLoggedIn(page, log))) {
        log.warn('session not logged in at job start — re-running login');
        const r = await ensureLoggedIn(page, {
          username: IG_USERNAME,
          password: IG_PASSWORD,
          totpSecret: IG_2FA_SECRET,
        }, log);
        if (!r.ok) {
          if (r.blocked) {
            state.blocked = true;
            state.blockedReason = r.reason || 'login_blocked';
          }
          const e = new Error(`login_failed:${r.reason || 'unknown'}`);
          if (r.blocked) e.blocked = true;
          throw e;
        }
        state.loggedIn = true;
      }

      switch (action) {
        case 'profile':    return scrapeProfile(page, payload || {}, log);
        case 'followers':  return scrapeFollowers(page, payload || {}, log);
        case 'following':  return scrapeFollowing(page, payload || {}, log);
        case 'stories':    return scrapeStories(page, payload || {}, log);
        default: {
          const e = new Error(`unknown_action:${action}`);
          e.statusCode = 400;
          throw e;
        }
      }
    });

    state.requestsToday += 1;
    state.lastSuccess = new Date().toISOString();
    state.lastError = null;
    return res.json({ ok: true, items });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    state.lastError = msg;

    // Trigger a blocked response if either explicitly flagged or a signal phrase
    const blocked = err?.blocked === true || isBlockedSignal(msg);
    if (blocked) {
      state.blocked = true;
      state.blockedReason = msg;
      log.warn(`scrape blocked: ${msg}`);
      return res.status(429).json({ ok: false, error: 'blocked', retry_after: 3600 });
    }

    // If the browser disconnected, schedule a teardown so next request boots cleanly
    if (/Target page, context or browser has been closed|Browser closed|Target closed|disconnected/i.test(msg)) {
      log.warn(`browser appears closed — scheduling teardown (${msg})`);
      teardownBrowser().catch(() => {});
    }

    const status = err?.statusCode || 500;
    log.error(`scrape failed (${action}): ${msg}`);
    return res.status(status).json({ ok: false, error: msg });
  }
});

// 404
app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

// Error handler of last resort
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  log.error(`unhandled: ${err.message}`);
  res.status(500).json({ ok: false, error: 'internal_error' });
});

const server = app.listen(PORT, () => {
  log.info(`listening on :${PORT} (proxy=${PROXY_HOST}, user=${IG_USERNAME})`);
  // Boot the browser in the background so first request is fast
  bootBrowser().catch((err) => log.error(`initial boot failed: ${err.message}`));
});

// ─── Graceful shutdown ───────────────────────────────────────────────────
async function shutdown(signal) {
  log.info(`received ${signal} — shutting down`);
  server.close(() => log.info('http server closed'));
  await teardownBrowser();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  log.error(`uncaughtException: ${err.stack || err.message}`);
  teardownBrowser().catch(() => {});
});
process.on('unhandledRejection', (reason) => {
  log.error(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});
