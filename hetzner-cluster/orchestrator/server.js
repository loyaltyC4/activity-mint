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
const crypto = require('crypto');

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

// ─── Response cache (Phase 4 / Ship C) ───────────────────────────────────
// Per-action TTL in seconds. 0 = no caching. The defaults are tuned to be
// long enough to absorb pane-stampede on quick navigation but short enough
// that scrapes feel fresh. Override via env CACHE_TTL_OVERRIDES like
// "profile=120,posts=90".
const DEFAULT_CACHE_TTLS = {
  profile:             60,
  posts:               60,
  followers:           45,
  following:           45,
  stories:             30,
  comments:            60,
  audience_enrichment: 180,
};
const CACHE_TTLS = (() => {
  const out = { ...DEFAULT_CACHE_TTLS };
  const env = process.env.CACHE_TTL_OVERRIDES;
  if (env) {
    for (const part of env.split(',')) {
      const [k, v] = part.split('=');
      if (k && v) out[k.trim()] = parseInt(v.trim(), 10) || 0;
    }
  }
  return out;
})();

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

// ─── Response cache helpers ──────────────────────────────────────────────
// Cache hit returns the items array immediately without going to a worker.
// Cache write fires async after a successful worker response. Keys are
// hash(action + canonical-JSON of payload) so logically-identical payloads
// share a cache entry regardless of property ordering.
function cacheKey(action, payload) {
  const canon = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
  return `cache:${action}:${crypto.createHash('sha1').update(canon).digest('hex')}`;
}
async function getCached(action, payload) {
  const ttl = CACHE_TTLS[action] | 0;
  if (!ttl) return null;
  try {
    const raw = await redis.get(cacheKey(action, payload));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    log.warn(`cache get failed for ${action}: ${err.message}`);
    return null;
  }
}
async function setCached(action, payload, items) {
  const ttl = CACHE_TTLS[action] | 0;
  if (!ttl || !Array.isArray(items)) return;
  try {
    await redis.set(cacheKey(action, payload), JSON.stringify(items), 'EX', ttl);
  } catch (err) {
    log.warn(`cache set failed for ${action}: ${err.message}`);
  }
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
  const cacheBypass = !!(body.cache_bypass || req.header('X-Cache-Bypass'));

  // Cache hit fast-path: return immediately without touching any worker
  if (!cacheBypass) {
    const cached = await getCached(action, payload);
    if (cached) {
      log.info(`cache HIT  ${action} user=${username || '-'}`);
      return res.json({ ok: true, items: cached, cached: true });
    }
  }

  const tried = [];
  // Try up to 3 workers: first pick + two failovers. Generous because we want
  // to absorb any single-worker login/scrape failure within the cluster rather
  // than surfacing it to the caller (which would then fall back to Apify).
  let lastError = null;
  let lastStatus = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { worker, reason } = await pickWorker({ username, excludeIds: tried });
    if (!worker) {
      log.warn(`no worker available after ${tried.length} attempts`);
      return res.status(503).json({
        ok: false,
        error: lastError || 'no_workers_available',
        tried,
      });
    }
    tried.push(worker.id);

    log.info(`-> ${worker.id} (${reason}) action=${action} user=${username || '-'}`);
    const fwd = await forwardScrape(worker, body);

    if (fwd.status >= 200 && fwd.status < 300 && fwd.body && fwd.body.ok) {
      await bumpWorkerRequests(worker.id);
      if (username) await setStickyTarget(username, worker.id);
      // Write to cache async, don't block the response
      setCached(action, payload, fwd.body.items).catch(() => {});
      return res.status(fwd.status).json(fwd.body);
    }

    // Failure path - decide whether to mark worker out and failover.
    const errMsg = (fwd.body && fwd.body.error) || (fwd.networkError ? 'network_error' : `worker_status_${fwd.status}`);
    lastError = errMsg;
    lastStatus = fwd.status;

    if (fwd.status === 429) {
      log.warn(`worker ${worker.id} returned 429 (${errMsg}) - blocking and failing over`);
      await markWorkerBlocked(worker.id);
      continue;
    }

    if (fwd.networkError) {
      log.warn(`worker ${worker.id} network error: ${errMsg} - failing over`);
      continue;
    }

    // Any other non-OK response. If it looks like a login failure, mark the
    // worker out of rotation so the cluster stops routing to it - otherwise
    // we'd keep picking the dead worker as least_loaded (it has 0 requests).
    if (/login_failed|credentials_rejected|not_logged_in|2fa_required_but_no_secret|password_input_not_found|username_input_not_found|block_signal_on_login_page|account_suspended/i.test(errMsg)) {
      log.warn(`worker ${worker.id} login broken (${errMsg}) - blocking and failing over`);
      await markWorkerBlocked(worker.id);
    } else {
      log.warn(`worker ${worker.id} returned ${fwd.status} (${errMsg}) - failing over`);
    }
  }

  // All attempts exhausted - surface the last error to the caller
  return res.status(lastStatus && lastStatus !== 0 ? lastStatus : 503).json({
    ok: false,
    error: lastError || 'all_workers_failed',
    tried,
  });
});

// ─── Batch endpoint ─────────────────────────────────────────────────────
// POST /scrape/batch
// Body: { tasks: [{ action, payload }, ...], strategy?: "parallel"|"sequential" }
//   - parallel (default): waves of N tasks where N = number of healthy workers.
//     Each task in a wave runs on a DIFFERENT worker so a single batch never
//     hot-spots one worker. Tasks past N queue up and run as workers free.
//   - sequential: one task at a time, sticky-routing per username (existing
//     single-task behavior). Useful when ordering matters.
//
// Returns: { ok: true, results: [{ action, payload, ok, items?, error? }, ...] }
// Per-task failures don't fail the whole batch - each result carries its own
// ok flag so the caller can stitch UI panels regardless.
//
// Why this exists: the dashboard wants to show profile + posts + followers +
// stories + comments-on-recent-post for a single username on one page load.
// Doing those sequentially through one worker is ~30-60s; fanning out across
// 3 healthy workers in parallel cuts it to ~10-15s.
app.post('/scrape/batch', requireSecret, async (req, res) => {
  const body = req.body || {};
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const strategy = (body.strategy || 'parallel').toLowerCase();
  const cacheBypass = !!(body.cache_bypass || req.header('X-Cache-Bypass'));

  if (tasks.length === 0) {
    return res.status(400).json({ ok: false, error: 'tasks_array_required' });
  }
  if (tasks.length > 32) {
    return res.status(400).json({ ok: false, error: 'too_many_tasks (max 32)' });
  }

  // Cache check per-task BEFORE we touch any worker. Tasks that hit the cache
  // get pre-filled results and skip routing entirely. Big win when the user
  // navigates back to a recently-loaded handle - whole batch can be all-hits.
  const results = new Array(tasks.length).fill(null);
  const pendingIndices = [];
  if (!cacheBypass) {
    await Promise.all(tasks.map(async (t, i) => {
      const cached = await getCached(t.action, t.payload);
      if (cached) {
        results[i] = { action: t.action, payload: t.payload, ok: true, items: cached, cached: true };
      } else {
        pendingIndices.push(i);
      }
    }));
    if (pendingIndices.length === 0) {
      log.info(`batch all cache HIT (${tasks.length} tasks)`);
      return res.json({ ok: true, results });
    }
    log.info(`batch cache: ${tasks.length - pendingIndices.length}/${tasks.length} hits, ${pendingIndices.length} pending`);
  } else {
    for (let i = 0; i < tasks.length; i++) pendingIndices.push(i);
  }

  // Pre-fetch healthy worker pool (one batch = one snapshot of who's available).
  // Workers blocked since last check stay excluded for this batch.
  const healthy = [];
  for (const w of workers) {
    if (!(await isWorkerBlocked(w.id))) healthy.push(w);
  }
  if (healthy.length === 0) {
    return res.status(503).json({
      ok: false,
      error: 'no_workers_available',
      results: tasks.map((t) => ({
        action: t.action, payload: t.payload, ok: false, error: 'no_workers_available',
      })),
    });
  }

  async function runOne(task, worker) {
    const fwd = await forwardScrape(worker, task);
    if (fwd.status >= 200 && fwd.status < 300 && fwd.body && fwd.body.ok) {
      await bumpWorkerRequests(worker.id);
      const uname = task?.payload?.username;
      if (uname) await setStickyTarget(uname, worker.id);
      // Write to cache async so next batch can hit-fast-path
      setCached(task.action, task.payload, fwd.body.items).catch(() => {});
      return { ok: true, items: fwd.body.items, worker: worker.id };
    }
    const errMsg = (fwd.body && fwd.body.error) || (fwd.networkError ? 'network_error' : `worker_status_${fwd.status}`);
    if (fwd.status === 429) {
      log.warn(`batch: worker ${worker.id} returned 429 (${errMsg}) - marking blocked`);
      await markWorkerBlocked(worker.id);
    } else if (/login_failed|credentials_rejected|not_logged_in|2fa_required|account_suspended|block_signal_on/i.test(errMsg)) {
      log.warn(`batch: worker ${worker.id} login broken (${errMsg}) - marking blocked`);
      await markWorkerBlocked(worker.id);
    }
    return { ok: false, error: errMsg, worker: worker.id };
  }

  // results array was already pre-filled with cache hits; pending tasks
  // are the ones still needing worker dispatch.
  const pendingTasks = pendingIndices.map((i) => ({ task: tasks[i], origIdx: i }));

  if (strategy === 'sequential') {
    for (const { task: t, origIdx } of pendingTasks) {
      const uname = t?.payload?.username;
      const tried = [];
      let r = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { worker } = await pickWorker({ username: uname, excludeIds: tried });
        if (!worker) { r = { ok: false, error: 'no_workers_available' }; break; }
        tried.push(worker.id);
        log.info(`-> ${worker.id} (batch seq attempt ${attempt}) action=${t.action} user=${uname || '-'}`);
        r = await runOne(t, worker);
        if (r.ok) break;
      }
      results[origIdx] = { action: t.action, payload: t.payload, ...r };
    }
  } else {
    // PARALLEL with per-task failover.
    // Each task gets up to 2 attempts on different healthy workers. We
    // process the work in waves: in each wave, every pending task is
    // assigned to a worker it has not tried, no two tasks share a worker
    // in the same wave. Tasks that succeed leave the queue. Tasks that
    // fail get re-queued with the failed worker added to their exclude
    // list until they succeed or hit the attempt cap.
    const MAX_ATTEMPTS = 2;
    let queue = pendingTasks.map(({ task, origIdx }) => ({ task, idx: origIdx, attempts: 0, excluded: new Set() }));
    let waveIdx = 0;

    while (queue.length > 0) {
      // Re-snapshot healthy workers each wave (workers marked blocked in
      // the previous wave should be excluded now).
      const fresh = [];
      for (const w of workers) {
        if (!(await isWorkerBlocked(w.id))) fresh.push(w);
      }
      if (fresh.length === 0) {
        for (const q of queue) {
          results[q.idx] = {
            action: q.task.action,
            payload: q.task.payload,
            ok: false,
            error: 'no_workers_available',
          };
        }
        break;
      }

      // Assign tasks to workers for this wave, never reusing a worker per wave
      // and respecting per-task excluded set.
      const usedWorkers = new Set();
      const assigned = [];      // [{ q, worker }, ...]
      const deferred = [];      // tasks that couldn't be assigned this wave
      for (const q of queue) {
        const w = fresh.find((wk) => !q.excluded.has(wk.id) && !usedWorkers.has(wk.id));
        if (w) {
          usedWorkers.add(w.id);
          assigned.push({ q, worker: w });
        } else {
          deferred.push(q);
        }
      }

      // Fire assigned tasks in parallel
      await Promise.all(assigned.map(async ({ q, worker }) => {
        q.attempts++;
        log.info(`-> ${worker.id} (batch wave ${waveIdx} attempt ${q.attempts}) action=${q.task.action} user=${q.task?.payload?.username || '-'}`);
        const r = await runOne(q.task, worker);
        if (r.ok) {
          results[q.idx] = { action: q.task.action, payload: q.task.payload, ...r };
        } else {
          q.excluded.add(worker.id);
          if (q.attempts >= MAX_ATTEMPTS) {
            results[q.idx] = { action: q.task.action, payload: q.task.payload, ok: false, error: r.error };
          } else {
            deferred.push(q);
          }
        }
      }));

      queue = deferred;
      waveIdx++;
      // Safety valve against pathological loops
      if (waveIdx > 12) {
        for (const q of queue) {
          results[q.idx] = {
            action: q.task.action,
            payload: q.task.payload,
            ok: false,
            error: 'batch_wave_cap_exceeded',
          };
        }
        break;
      }
    }
  }

  res.json({ ok: true, results });
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
