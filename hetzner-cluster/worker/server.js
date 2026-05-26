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
const { scrapePosts } = require('./scrapers/posts');
const { scrapeComments } = require('./scrapers/comments');
const { enrichAudience } = require('./scrapers/audience_enrichment');
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
  blockedAt: null,     // Date.now() ms — used by auto-unblock probe
};

// Errors that are recoverable via time (rate limits, IP blocks) and should
// auto-unblock once the cooldown expires. Credential/suspension failures are
// NOT in this list — those require human intervention.
const AUTO_UNBLOCK_RE = /blocked_signal|block_signal_on_login_page|challenge_|rate_limited/i;
const RATE_LIMIT_UNBLOCK_MS = 65 * 60 * 1000;  // 65 min — IG rate limits are ~60 min
const IP_BLOCK_UNBLOCK_MS   = 90 * 60 * 1000;  // 90 min — IP/login-page blocks last longer

function setBlocked(reason) {
  state.blocked = true;
  state.blockedReason = reason;
  state.blockedAt = Date.now();
  log.warn(`worker blocked — reason=${reason}`);
}

function clearBlocked(via) {
  state.blocked = false;
  state.blockedReason = null;
  state.blockedAt = null;
  log.info(`auto-unblock: block cleared via ${via}`);
}

// Returns the appropriate cooldown in ms for a given block reason,
// or null if the block is not auto-unblockable.
function autoUnblockCooldown(reason) {
  if (!reason || !AUTO_UNBLOCK_RE.test(reason)) return null;
  return /block_signal_on_login_page|ip_block/i.test(reason)
    ? IP_BLOCK_UNBLOCK_MS
    : RATE_LIMIT_UNBLOCK_MS;
}

let browserContext = null;        // CloakBrowser BrowserContext (persistent, warm across requests)
let pagePool = [];                // [{page, busy}] - N parallel scrape slots per worker
let bootPromise = null;           // promise for the in-flight boot
let lastResetDayUTC = currentUTCDay();
// Pool size: how many concurrent scrapes a single worker handles. 2 doubles
// throughput per worker at the cost of running two browser tabs at once
// against IG with the same logged-in account. Higher than 2 starts to make
// IG suspicious of the account; 2 is the sweet spot empirically.
const POOL_SIZE = Math.max(1, Math.min(parseInt(process.env.WORKER_POOL_SIZE || '2', 10) || 2, 4));

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

// ─── Auto-unblock probe ───────────────────────────────────────────────────
// Every 5 minutes: if blocked by a recoverable signal and the cooldown has
// elapsed, attempt a login check and clear the block without needing a restart.
// Login-failed / account-suspended blocks are ignored — those need human action.
setInterval(async () => {
  if (!state.blocked || !state.blockedAt) return;
  const cooldownMs = autoUnblockCooldown(state.blockedReason);
  if (!cooldownMs) return; // non-recoverable block — skip
  const elapsed = Date.now() - state.blockedAt;
  if (elapsed < cooldownMs) return; // cooldown not yet elapsed

  log.info(`auto-unblock probe: ${Math.round(elapsed / 60000)}min since block (reason=${state.blockedReason})`);
  try {
    const idlePage = pagePool.find(s => !s.busy)?.page;
    if (!idlePage) { log.info('auto-unblock probe: no idle page available, will retry'); return; }

    const loggedIn = await isLoggedIn(idlePage, log);
    if (loggedIn) {
      clearBlocked('background-probe');
      return;
    }

    log.info('auto-unblock probe: session expired, re-running ensureLoggedIn...');
    const r = await ensureLoggedIn(idlePage, {
      username: IG_USERNAME, password: IG_PASSWORD, totpSecret: IG_2FA_SECRET,
    }, log);
    if (r.ok) {
      state.loggedIn = true;
      clearBlocked('background-relogin');
    } else {
      // Block updated with whatever new error occurred (may be permanent now)
      setBlocked(r.reason || state.blockedReason);
      log.warn(`auto-unblock probe: re-login failed — reason=${r.reason}`);
    }
  } catch (err) {
    log.warn(`auto-unblock probe error: ${err.message}`);
  }
}, 5 * 60 * 1000).unref();

// ─── Browser bootstrap (warm context + page pool) ────────────────────────
// Boot is idempotent and reuses an existing context whenever possible. The
// pool of N pages is created up front so all N slots are warm by the time
// the first request lands. Cookies/storage are shared across pages in one
// BrowserContext, so we only run the IG login once on the first page.
async function bootBrowser() {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_HTTP_PORT}`;
    log.info(`launching CloakBrowser (proxy=${PROXY_HOST}:${PROXY_HTTP_PORT}, poolSize=${POOL_SIZE})`);
    try {
      const { launchPersistentContext } = await getCloakbrowser();
      const ctx = await launchPersistentContext({
        userDataDir: PROFILE_DIR,
        headless: true,
        proxy: proxyUrl,
        geoip: true,
        viewport: { width: 1366, height: 800 },
        deviceScaleFactor: 1,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      ctx.setDefaultTimeout(15000);
      ctx.setDefaultNavigationTimeout(30000);

      // Reuse any pages the persistent profile dir restored; pad to POOL_SIZE.
      const existing = ctx.pages();
      const firstPage = existing[0] || await ctx.newPage();
      pagePool = [{ page: firstPage, busy: false }];
      for (let i = 1; i < POOL_SIZE; i++) {
        const p = await ctx.newPage();
        pagePool.push({ page: p, busy: false });
      }

      // Crash handlers - drop the whole pool when the context dies.
      ctx.on('close', () => {
        log.warn('browser context closed');
        browserContext = null;
        pagePool = [];
        state.loggedIn = false;
      });
      for (const slot of pagePool) {
        slot.page.on('crash', () => log.warn(`pool page crashed`));
      }

      // Login once on the first page. Cookies/storage propagate across the
      // whole context so the other N-1 pages are immediately logged in too.
      const result = await ensureLoggedIn(firstPage, {
        username: IG_USERNAME,
        password: IG_PASSWORD,
        totpSecret: IG_2FA_SECRET,
      }, log);

      if (!result.ok) {
        state.loggedIn = false;
        state.lastError = `login_failed:${result.reason || 'unknown'}`;
        if (result.blocked) {
          setBlocked(result.reason || 'login_blocked');
        }
      } else {
        state.loggedIn = true;
        state.lastError = null;
        log.info(`logged in OK as ${IG_USERNAME} (${POOL_SIZE} pages warm)`);

        // Phase 4: pre-warm each page to https://www.instagram.com/ so the
        // first /scrape doesn't pay the initial ~3-5s navigation cost. Any
        // subsequent scraper that only needs IG-origin context (profile via
        // web_profile_info, stories via reels_media) can call its API
        // directly without re-navigating.
        await Promise.all(pagePool.map(async (slot, i) => {
          try {
            await slot.page.goto('https://www.instagram.com/', {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });
          } catch (err) {
            log.warn(`pre-warm goto page[${i}] failed: ${err.message}`);
          }
        }));
        log.info(`pages pre-warmed to IG home (direct-API path is HOT)`);
      }

      browserContext = ctx;
      return { ctx, pageCount: pagePool.length };
    } catch (err) {
      log.error(`browser boot failed: ${err.message}`);
      state.lastError = `boot_failed:${err.message}`;
      browserContext = null;
      pagePool = [];
      throw err;
    } finally {
      bootPromise = null;
    }
  })();
  return bootPromise;
}

async function ensureBrowser() {
  if (browserContext && pagePool.length > 0) {
    // Re-check every slot is still alive
    const dead = pagePool.filter((s) => s.page.isClosed());
    if (dead.length === 0) return { ctx: browserContext };
    log.warn(`${dead.length}/${pagePool.length} pool pages closed; recreating pool`);
  }
  return bootBrowser();
}

async function teardownBrowser() {
  if (!browserContext) return;
  log.info('tearing down browser context');
  try { await browserContext.close(); } catch (err) { log.warn(`ctx.close errored: ${err.message}`); }
  browserContext = null;
  pagePool = [];
  state.loggedIn = false;
}

// ─── Page acquisition + release (replaces single-flight queue) ────────────
// Wait for an idle slot, mark it busy, return the slot. Caller MUST call
// releasePage() in a finally block. Concurrency cap = POOL_SIZE.
async function acquirePage(timeoutMs = 60000) {
  await ensureBrowser();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const idle = pagePool.find((s) => !s.busy && !s.page.isClosed());
    if (idle) {
      idle.busy = true;
      return idle;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('page_acquire_timeout');
}

function releasePage(slot) {
  if (slot) slot.busy = false;
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
    blocked_at: state.blockedAt ? new Date(state.blockedAt).toISOString() : null,
    auto_unblock_at: (state.blockedAt && autoUnblockCooldown(state.blockedReason))
      ? new Date(state.blockedAt + autoUnblockCooldown(state.blockedReason)).toISOString()
      : null,
  });
});

app.post('/scrape', requireSecret, async (req, res) => {
  maybeResetCounter();

  if (state.blocked) {
    // Auto-unblock: if the cooldown for this block type has passed, attempt a
    // lightweight session check before giving up. Credential/suspension blocks
    // (not matched by autoUnblockCooldown) always return 429 — human needed.
    const cooldownMs = autoUnblockCooldown(state.blockedReason);
    const elapsed = state.blockedAt ? Date.now() - state.blockedAt : Infinity;
    if (cooldownMs && elapsed >= cooldownMs) {
      log.info(`auto-unblock: cooldown ${Math.round(elapsed/60000)}min elapsed for reason=${state.blockedReason}, checking session...`);
      try {
        const idlePage = pagePool.find(s => !s.busy)?.page;
        if (idlePage) {
          const ok = await isLoggedIn(idlePage, log);
          if (ok) {
            clearBlocked('session-check-on-request');
          } else {
            log.info('auto-unblock: not logged in, re-running ensureLoggedIn...');
            const r = await ensureLoggedIn(idlePage, {
              username: IG_USERNAME, password: IG_PASSWORD, totpSecret: IG_2FA_SECRET,
            }, log);
            if (r.ok) {
              state.loggedIn = true;
              clearBlocked('re-login-on-request');
            } else {
              // Replace with updated block (may be a different reason now)
              setBlocked(r.reason || state.blockedReason);
            }
          }
        }
      } catch (probeErr) {
        log.warn(`auto-unblock probe failed: ${probeErr.message}`);
      }
    }
    if (state.blocked) {
      return res.status(429).json({ ok: false, error: 'blocked', retry_after: 3600 });
    }
  }

  const { action, payload } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ ok: false, error: 'action_required' });
  }

  // Acquire one of the pool's idle pages and run the scrape on it. Multiple
  // /scrape requests can run concurrently (up to POOL_SIZE), each on its own
  // Page so navigations don't race.
  let slot = null;
  try {
    slot = await acquirePage();
    const page = slot.page;

    // Confirm we're still logged in on THIS page. Login state is per-context
    // (shared cookies) so it's usually fine, but a stale cookie or session
    // expiry can still surface here.
    if (!state.loggedIn || !(await isLoggedIn(page, log))) {
      log.warn('session not logged in at job start - re-running login');
      const r = await ensureLoggedIn(page, {
        username: IG_USERNAME,
        password: IG_PASSWORD,
        totpSecret: IG_2FA_SECRET,
      }, log);
      if (!r.ok) {
        if (r.blocked) {
          setBlocked(r.reason || 'login_blocked');
        }
        const e = new Error(`login_failed:${r.reason || 'unknown'}`);
        if (r.blocked) e.blocked = true;
        throw e;
      }
      state.loggedIn = true;
    }

    let items;
    switch (action) {
      case 'profile':              items = await scrapeProfile(page, payload || {}, log); break;
      case 'followers':            items = await scrapeFollowers(page, payload || {}, log); break;
      case 'following':            items = await scrapeFollowing(page, payload || {}, log); break;
      case 'stories':              items = await scrapeStories(page, payload || {}, log); break;
      case 'posts':                items = await scrapePosts(page, payload || {}, log); break;
      case 'comments':             items = await scrapeComments(page, payload || {}, log); break;
      case 'audience_enrichment':  items = await enrichAudience(page, payload || {}, log); break;
      default: {
        const e = new Error(`unknown_action:${action}`);
        e.statusCode = 400;
        throw e;
      }
    }

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
      setBlocked(msg);
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
  } finally {
    releasePage(slot);
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
