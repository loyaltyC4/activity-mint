/**
 * Activity Mint Orchestrator.
 *
 * Public entrypoint on :3001. Routes /scrape requests to the worker
 * with the lowest load (or sticky for known targets), tracks per-worker
 * state in Redis, and fails over on 429.
 */

'use strict';

const express = require('express');
const fetch = require('node-fetch');
const Redis = require('ioredis');

// ─── Config ──────────────────────────────────────────────────────────────
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || '';
const WORKER_HOSTS_RAW = process.env.WORKER_HOSTS || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const ROUTING_STRATEGY = (process.env.ROUTING_STRATEGY || 'sticky').toLowerCase();
const PORT = parseInt(process.env.PORT || '3001', 10);
const STICKY_TTL_SECONDS = 7 * 24 * 60 * 60;       // 7 days
const BLOCK_TTL_SECONDS = 60 * 60;                  // 1 hour
const WORKER_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;    // 5 minutes (followers list can be slow)
const HEALTH_TIMEOUT_MS = 5 * 1000;

// ─── Logger ──────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }
const log = {
  info:  (m) => process.stdout.write(`[${ts()}] [orchestrator] INFO  ${m}\n`),
  warn:  (m) => process.stdout.write(`[${ts()}] [orchestrator] WARN  ${m}\n`),
  error: (m) => process.stderr.write(`[${ts()}] [orchestrator] ERROR ${m}\n`),
};

// ─── Parse worker hosts ──────────────────────────────────────────────────
// Each entry can be `host:port` or `host_id:port`. We treat the host portion
// before `:` as the worker id (used as the URL host AND as the state key).
const workers = WORKER_HOSTS_RAW.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [host, port] = entry.split(':');
    return {
      id: host,
      url: `http://${host}:${port || '3010'}`,
    };
  });

if (!SCRAPER_SECRET) {
  log.error('SCRAPER_SECRET missing — refusing to start');
  process.exit(1);
}
if (workers.length === 0) {
  log.error('WORKER_HOSTS empty — nothing to route to');
  process.exit(1);
}
log.info(`routing strategy=${ROUTING_STRATEGY}, workers=${workers.map((w) => w.id).join(',')}`);

// ─── Redis ───────────────────────────────────────────────────────────────
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(50 * times, 2000),
});
redis.on('error', (err) => log.error(`redis: ${err.message}`));
redis.on('ready', () => log.info('redis connected'));

// Round-robin counter (used when ROUTING_STRATEGY === 'round_robin' or as tiebreak)
let rrCursor = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────
function workerById(id) {
  return workers.find((w) => w.id === id) || null;
}

async function getWorkerRequests(id) {
  const v = await redis.get(`worker:${id}:requests_today`).catch(() => null);
  return v ? parseInt(v, 10) || 0 : 0;
}

async function isWorkerBlocked(id) {
  const v = await redis.get(`worker:${id}:blocked_until`).catch(() => null);
  if (!v) return false;
  const until = Date.parse(v);
  if (Number.isFinite(until) && until > Date.now()) return true;
  // expired — clean up
  await redis.del(`worker:${id}:blocked_until`).catch(() => {});
  return false;
}

async function markWorkerBlocked(id, ttlSeconds = BLOCK_TTL_SECONDS) {
  const until = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await redis.set(`worker:${id}:blocked_until`, until, 'EX', ttlSeconds).catch((err) => {
    log.warn(`redis set blocked_until failed: ${err.message}`);
  });
  log.warn(`worker ${id} marked blocked until ${until}`);
}

async function bumpWorkerRequests(id) {
  try { await redis.incr(`worker:${id}:requests_today`); }
  catch (err) { log.warn(`redis incr failed for ${id}: ${err.message}`); }
}

async function getStickyTarget(username) {
  if (!username) return null;
  return redis.get(`target:${username}`).catch(() => null);
}
async function setStickyTarget(username, workerId) {
  if (!username || !workerId) return;
  await redis.set(`target:${username}`, workerId, 'EX', STICKY_TTL_SECONDS).catch((err) => {
    log.warn(`redis set sticky failed: ${err.message}`);
  });
}

/**
 * Choose the next worker to use, excluding any ids in `excludeIds`.
 *  - Sticky: prefer the cached worker for this username if free.
 *  - Otherwise: pick the lowest requests_today among non-blocked, non-excluded.
 *  - Round-robin: advance the global cursor among non-blocked, non-excluded.
 */
async function pickWorker({ username, excludeIds = [] }) {
  const exclude = new Set(excludeIds);

  // Sticky lookup
  if (ROUTING_STRATEGY === 'sticky' && username) {
    const stickyId = await getStickyTarget(username);
    if (stickyId && !exclude.has(stickyId) && workerById(stickyId)) {
      const blocked = await isWorkerBlocked(stickyId);
      if (!blocked) {
        return { worker: workerById(stickyId), reason: 'sticky' };
      }
    }
  }

  // Build candidate list
  const candidates = [];
  for (const w of workers) {
    if (exclude.has(w.id)) continue;
    if (await isWorkerBlocked(w.id)) continue;
    candidates.push(w);
  }
  if (candidates.length === 0) return { worker: null, reason: 'no_workers_available' };

  if (ROUTING_STRATEGY === 'round_robin') {
    const w = candidates[rrCursor % candidates.length];
    rrCursor = (rrCursor + 1) % Math.max(candidates.length, 1);
    return { worker: w, reason: 'round_robin' };
  }

  // Default / 'sticky' fallback: pick lowest requests_today
  const counts = await Promise.all(candidates.map((w) => getWorkerRequests(w.id)));
  let bestIdx = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (counts[i] < counts[bestIdx]) bestIdx = i;
  }
  return { worker: candidates[bestIdx], reason: 'least_loaded' };
}

/**
 * Forward a /scrape request to a worker. Returns a normalised object.
 * { status, body, networkError? }
 */
async function forwardScrape(worker, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${worker.url}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': SCRAPER_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let json = null;
    try { json = await resp.json(); }
    catch (err) { json = { ok: false, error: `invalid_json_from_worker:${err.message}` }; }
    return { status: resp.status, body: json };
  } catch (err) {
    return { status: 0, body: { ok: false, error: `network_error:${err.message}` }, networkError: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function callWorkerHealth(worker) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${worker.url}/health`, { signal: controller.signal });
    const json = await resp.json().catch(() => ({ error: 'invalid_json' }));
    return { worker_id: worker.id, reachable: resp.ok, ...json };
  } catch (err) {
    return { worker_id: worker.id, reachable: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Daily reset (UTC midnight) ──────────────────────────────────────────
function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  ));
  return next.getTime() - now.getTime();
}

async function resetDailyCounters() {
  log.info('resetting daily worker request counters');
  try {
    const pipeline = redis.pipeline();
    for (const w of workers) pipeline.del(`worker:${w.id}:requests_today`);
    await pipeline.exec();
  } catch (err) {
    log.warn(`daily reset failed: ${err.message}`);
  }
}

function scheduleDailyReset() {
  const wait = msUntilNextUTCMidnight();
  log.info(`next counter reset in ${Math.round(wait / 60000)} minutes`);
  setTimeout(async () => {
    await resetDailyCounters();
    // Then run every 24h after that
    setInterval(resetDailyCounters, 24 * 60 * 60 * 1000).unref();
  }, wait).unref();
}
scheduleDailyReset();

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

app.post('/scrape', requireSecret, async (req, res) => {
  const body = req.body || {};
  const { action, payload } = body;
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ ok: false, error: 'action_required' });
  }
  const username = payload && typeof payload.username === 'string' ? payload.username.trim().replace(/^@/, '') : null;

  const tried = [];
  // Try up to 2 workers: first pick + one failover
  for (let attempt = 0; attempt < 2; attempt++) {
    const { worker, reason } = await pickWorker({ username, excludeIds: tried });
    if (!worker) {
      log.warn(`no worker available after ${tried.length} attempts`);
      return res.status(503).json({ ok: false, error: 'no_workers_available' });
    }
    tried.push(worker.id);

    log.info(`-> ${worker.id} (${reason}) action=${action} user=${username || '-'}`);
    const fwd = await forwardScrape(worker, body);

    if (fwd.status === 429) {
      const errMsg = (fwd.body && fwd.body.error) || 'blocked';
      log.warn(`worker ${worker.id} returned 429 (${errMsg}) — failing over`);
      await markWorkerBlocked(worker.id);
      continue;
    }

    if (fwd.networkError) {
      log.warn(`worker ${worker.id} network error: ${fwd.body.error} — trying another worker`);
      continue;
    }

    if (fwd.status >= 200 && fwd.status < 300 && fwd.body && fwd.body.ok) {
      await bumpWorkerRequests(worker.id);
      if (username) await setStickyTarget(username, worker.id);
      return res.status(fwd.status).json(fwd.body);
    }

    // Non-OK but not 429 — surface the worker's error to the caller
    return res.status(fwd.status || 502).json(fwd.body || { ok: false, error: 'worker_failure' });
  }

  return res.status(503).json({ ok: false, error: 'all_workers_blocked_or_unavailable' });
});

app.get('/health', requireSecret, async (_req, res) => {
  const results = await Promise.all(workers.map((w) => callWorkerHealth(w)));
  // Augment with orchestrator-side data
  for (const r of results) {
    r.blocked_until = await redis.get(`worker:${r.worker_id}:blocked_until`).catch(() => null);
    r.orchestrator_requests_today = await getWorkerRequests(r.worker_id);
  }
  res.json({ ok: true, items: results });
});

// 404
app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  log.error(`unhandled: ${err.message}`);
  res.status(500).json({ ok: false, error: 'internal_error' });
});

const server = app.listen(PORT, () => log.info(`listening on :${PORT}`));

// ─── Graceful shutdown ───────────────────────────────────────────────────
async function shutdown(signal) {
  log.info(`received ${signal} — shutting down`);
  server.close(() => log.info('http server closed'));
  try { await redis.quit(); } catch (err) { log.warn(`redis.quit: ${err.message}`); }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => log.error(`uncaughtException: ${err.stack || err.message}`));
process.on('unhandledRejection', (reason) => {
  log.error(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});
