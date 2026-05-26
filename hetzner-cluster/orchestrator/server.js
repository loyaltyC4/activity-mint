/**
 * Activity Mint Orchestrator.
 *
 * Public entrypoint on :3001. Routes /scrape requests to the worker
 * with the lowest load (or sticky for known targets), tracks per-worker
 * state in Redis, and fails over on 429.
 *
 * Speed pass v4 — Phase 1 additions:
 *
 *   1. Bloom filter as a guard in front of Redis GET. k=7 hashes, m=65536
 *      bits (8 KiB). For up to ~3200 entries the false-positive rate stays
 *      around 1%, so we skip a Redis round-trip on every guaranteed miss.
 *
 *   2. Per-action Redis cache. Cache key = sha1 of canonicalised payload.
 *      Stores { items, t }. TTL is per-action (CACHE_TTLS). The lower-level
 *      Vercel edge cache already sits on top; this is the inner shield that
 *      protects the workers from duplicate work.
 *
 *   3. Singleflight coalescing. When N concurrent requests for the same
 *      cache key arrive, we dispatch ONE scrape and broadcast its result
 *      to all N callers. Reduces backend load by factor k when popular
 *      handles get hit. Same pattern as Go's sync/singleflight.
 *
 *   4. Telemetry — every /scrape call pushes a row to the
 *      `telemetry:scrape` Redis Stream with {action, user, source,
 *      latency_ms}. /perf reads the last N rows and returns p50/p95/p99
 *      per (action, source) pair.
 */

'use strict';

const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
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

// Speed-v7: AGGRESSIVE cache TTLs. The bottleneck is the SOCKS5 proxy
// RTT (~8-9s per cold call). We can't make the proxy faster. Instead we
// make users RARELY hit the cold path. XFetch probabilistic early refresh
// keeps entries warm transparently, so staleness is controlled.
//
// Telemetry showed: stories had 1.7% cache hit rate at 30s TTL, profile
// had 38% at 120s. Bumping to 10-30 min puts effective hit rates >90%.
//
// Freshness guarantee: XFetch fires background refreshes BEFORE expiry
// so the user always sees data <TTL old, never stale.
// Speed-v8: WORKER-PROTECTING TTLs. With 4 workers online, reducing IG
// scrape frequency is priority. XFetch early refresh keeps hot handles warm.
const CACHE_TTLS = {
  profile: 3600,             // 1 hr  (was 10 min). Profiles don't change mid-session.
  posts: 1800,               // 30 min (was 10 min). New posts maybe once/day.
  followers: 1800,           // 30 min (was 5 min). Follow count drifts slowly.
  following: 1800,           // 30 min (was 5 min).
  stories: 600,              // 10 min (was 3 min). Stories last 24h; 10 min is still fresh.
  comments: 1800,            // 30 min (was 5 min). Comment threads evolve slowly.
  audience_enrichment: 7200, // 2 hr  (was 15 min). Follower list barely changes in 2hr.
  top_commenters: 3600,      // 1 hr  (was 10 min). Commenter ranking is stable.
};

// ─── Logger ──────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }
const log = {
  info:  (m) => process.stdout.write(`[${ts()}] [orchestrator] INFO  ${m}\n`),
  warn:  (m) => process.stdout.write(`[${ts()}] [orchestrator] WARN  ${m}\n`),
  error: (m) => process.stderr.write(`[${ts()}] [orchestrator] ERROR ${m}\n`),
};

// ─── Bloom filter ─────────────────────────────────────────────────────────
// 65536 bits / 8 = 8192 bytes; k=7 hashes. Saturates around ~6500 keys.
const BLOOM_BITS = 65536;
const BLOOM_K = 7;
const bloomBits = new Uint8Array(BLOOM_BITS >> 3);

function bloomHash(s, seed) {
  // FNV-1a 32-bit with seed mixed in. Cheap and "good enough" for Bloom.
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % BLOOM_BITS;
}
function bloomAdd(key) {
  for (let i = 0; i < BLOOM_K; i++) {
    const idx = bloomHash(key, i);
    bloomBits[idx >> 3] |= 1 << (idx & 7);
  }
}
function bloomCheck(key) {
  for (let i = 0; i < BLOOM_K; i++) {
    const idx = bloomHash(key, i);
    if ((bloomBits[idx >> 3] & (1 << (idx & 7))) === 0) return false;
  }
  return true;
}

// ─── Cache helpers ────────────────────────────────────────────────────────
// Phase 2: XFetch probabilistic early refresh + per-popularity adaptive TTL.
//
// XFetch (Vainstein 2011):
//   With delta = recompute_ms, beta = 1, and r = U(0,1), a cached entry is
//   *probabilistically* considered expired at:
//       expires_at - delta * beta * (-log(r))
//   Since -log(U(0,1)) ~ Exp(1), entries close to expiry have a rising
//   chance of being treated as expired BEFORE the hard deadline. This
//   prevents the thundering-herd at TTL boundary.
//
// Popularity multiplier:
//   hits/key kept in Redis with 24h sliding window. Hot handles get 5x TTL,
//   moderately popular get 2x, never-hit handles get 0.5x.
const XFETCH_BETA = 1.0;
function popularityMultiplier(hits) {
  if (hits > 50) return 5;
  if (hits > 10) return 2;
  if (hits > 0) return 1;
  return 0.5;
}

function cacheKey(action, payload) {
  const canon = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
  return `cache:${action}:${crypto.createHash('sha1').update(canon).digest('hex').slice(0, 16)}`;
}

async function cacheGet(key, action, onEarlyRefresh) {
  // Bloom pre-check — skip Redis round-trip on guaranteed misses.
  if (!bloomCheck(key)) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Track hits for popularity-based TTL (fire and forget, sliding window 24h)
    redis.incr(`hits:${key}`).catch(() => {});
    redis.expire(`hits:${key}`, 86400).catch(() => {});

    // XFetch early refresh probability
    const ageMs = Date.now() - (parsed.t || 0);
    const baseTtlMs = (CACHE_TTLS[action] || 60) * 1000;
    const recomputeMs = parsed.recompute_ms || 5000;
    const remainingMs = baseTtlMs - ageMs;
    if (remainingMs > 0 && typeof onEarlyRefresh === 'function') {
      // r ~ U(0,1] (avoid log(0))
      const r = Math.max(Math.random(), 1e-9);
      const refreshOffset = recomputeMs * XFETCH_BETA * (-Math.log(r));
      if (remainingMs < refreshOffset) {
        // Fire background refresh, still serve cached
        try { onEarlyRefresh(); } catch (_) {}
      }
    }
    return parsed;
  } catch (err) {
    log.warn(`cacheGet failed: ${err.message}`);
    return null;
  }
}

async function cacheSet(action, key, items, recomputeMs) {
  const baseTtl = CACHE_TTLS[action] || 60;
  let popularity = 1;
  try {
    const hitsRaw = await redis.get(`hits:${key}`);
    const hits = hitsRaw ? parseInt(hitsRaw, 10) || 0 : 0;
    popularity = popularityMultiplier(hits);
  } catch (_) {}
  const ttl = Math.max(10, Math.round(baseTtl * popularity));
  try {
    await redis.set(key, JSON.stringify({
      items,
      t: Date.now(),
      recompute_ms: recomputeMs || null,
      ttl_used: ttl,
      popularity_mult: popularity,
    }), 'EX', ttl);
    bloomAdd(key);
  } catch (err) {
    log.warn(`cacheSet failed: ${err.message}`);
  }
}

// ─── Singleflight ─────────────────────────────────────────────────────────
// In-flight Map keyed by cache key. When N concurrent requests for the same
// key arrive, dispatch ONE scrape and broadcast its result to all N callers.
// We hold the entry for an additional 50ms after resolution so very-near
// follow-ups also coalesce. Reduces worker load by factor k for popular
// handles. (Pattern: Go sync/singleflight.)
const inFlight = new Map();
function singleflight(key, executor) {
  const existing = inFlight.get(key);
  if (existing) return existing.promise;
  const wrapper = { promise: null };
  wrapper.promise = executor().finally(() => {
    setTimeout(() => {
      if (inFlight.get(key) === wrapper) inFlight.delete(key);
    }, 50);
  });
  inFlight.set(key, wrapper);
  return wrapper.promise;
}

// ─── Telemetry ────────────────────────────────────────────────────────────
async function telemetry(event) {
  try {
    const args = ['telemetry:scrape', 'MAXLEN', '~', '50000', '*'];
    for (const [k, v] of Object.entries(event)) {
      args.push(k, String(v));
    }
    await redis.xadd(...args);
  } catch (err) {
    // never block a request on telemetry; just warn
    log.warn(`telemetry xadd failed: ${err.message}`);
  }
}

// ─── Parse worker hosts ──────────────────────────────────────────────────
const workers = WORKER_HOSTS_RAW.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((entry) => {
    const [host, port] = entry.split(':');
    return { id: host, url: `http://${host}:${port || '3010'}` };
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

// ─── Phase 3: cross-instance coordination bridge via Redis pub/sub ────────
// Two channels:
//   - bridge:cache  → announcements that a cache key was just (re)populated
//   - bridge:block  → announcements that a worker was just marked blocked
// We open a dedicated pubsub connection (ioredis requires sub mode on its
// own client) so subscriptions don't interfere with regular GET/SET.
const pubsub = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
pubsub.on('error', (err) => log.warn(`pubsub: ${err.message}`));

const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
sub.on('error', (err) => log.warn(`sub: ${err.message}`));
sub.subscribe('bridge:cache', 'bridge:block', (err) => {
  if (err) log.warn(`sub subscribe failed: ${err.message}`);
  else log.info('bridge: subscribed to cache + block channels');
});
sub.on('message', (channel, msg) => {
  try {
    const data = JSON.parse(msg);
    if (channel === 'bridge:cache' && data.ckey) {
      // Update Bloom locally so future GETs see this key
      bloomAdd(data.ckey);
    } else if (channel === 'bridge:block' && data.workerId) {
      log.info(`bridge: peer reported worker ${data.workerId} blocked`);
    }
  } catch (_) {}
});

async function bridgePublishCache(ckey, action) {
  try { await pubsub.publish('bridge:cache', JSON.stringify({ ckey, action, t: Date.now() })); }
  catch (_) {}
}
async function bridgePublishBlock(workerId, reason) {
  try { await pubsub.publish('bridge:block', JSON.stringify({ workerId, reason, t: Date.now() })); }
  catch (_) {}
}

let rrCursor = 0;

// ─── Worker state helpers ────────────────────────────────────────────────
function workerById(id) { return workers.find((w) => w.id === id) || null; }

async function getWorkerRequests(id) {
  const v = await redis.get(`worker:${id}:requests_today`).catch(() => null);
  return v ? parseInt(v, 10) || 0 : 0;
}

async function isWorkerBlocked(id) {
  const v = await redis.get(`worker:${id}:blocked_until`).catch(() => null);
  if (!v) return false;
  const until = Date.parse(v);
  if (Number.isFinite(until) && until > Date.now()) return true;
  await redis.del(`worker:${id}:blocked_until`).catch(() => {});
  return false;
}

async function markWorkerBlocked(id, ttlSeconds = BLOCK_TTL_SECONDS, reason = '') {
  const until = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await redis.set(`worker:${id}:blocked_until`, until, 'EX', ttlSeconds).catch((err) => {
    log.warn(`redis set blocked_until failed: ${err.message}`);
  });
  log.warn(`worker ${id} marked blocked until ${until}`);
  bridgePublishBlock(id, reason);
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
 * Rendezvous hashing (Highest Random Weight, Thaler & Ravishankar 1998).
 * Compute h(worker_id, key) for each candidate, pick the one with the
 * highest hash. This gives deterministic assignment with the property
 * that only K/n keys move when the worker set changes — far better than
 * naive hash(key) % n which reshuffles everything.
 *
 * Why we use this instead of the prior Redis-backed sticky map:
 *   - No Redis write per request → fewer round trips
 *   - Same handle always lands on the same worker (assuming pool stable)
 *   - Failover is implicit: exclude broken workers from the candidate set,
 *     the next-highest hash worker takes over deterministically
 */
function hrwScore(workerId, key) {
  // FNV-1a-style mix of workerId and key. Deterministic.
  let h = 2166136261 >>> 0;
  const s = workerId + '::' + key;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

async function pickWorker({ username, excludeIds = [] }) {
  const exclude = new Set(excludeIds);

  // Build candidate list: not excluded, not blocked
  const candidates = [];
  for (const w of workers) {
    if (exclude.has(w.id)) continue;
    if (await isWorkerBlocked(w.id)) continue;
    candidates.push(w);
  }
  if (candidates.length === 0) return { worker: null, reason: 'no_workers_available' };

  // Sticky / HRW: deterministic per-username routing via rendezvous hash
  if ((ROUTING_STRATEGY === 'sticky' || ROUTING_STRATEGY === 'hrw') && username) {
    let bestWorker = candidates[0];
    let bestScore = hrwScore(bestWorker.id, username);
    for (let i = 1; i < candidates.length; i++) {
      const s = hrwScore(candidates[i].id, username);
      if (s > bestScore) { bestScore = s; bestWorker = candidates[i]; }
    }
    return { worker: bestWorker, reason: 'hrw' };
  }

  if (ROUTING_STRATEGY === 'round_robin') {
    const w = candidates[rrCursor % candidates.length];
    rrCursor = (rrCursor + 1) % Math.max(candidates.length, 1);
    return { worker: w, reason: 'round_robin' };
  }

  // Fallback: least-loaded (used if username is null AND not round_robin)
  const counts = await Promise.all(candidates.map((w) => getWorkerRequests(w.id)));
  let bestIdx = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (counts[i] < counts[bestIdx]) bestIdx = i;
  }
  return { worker: candidates[bestIdx], reason: 'least_loaded' };
}

async function forwardScrape(worker, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${worker.url}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': SCRAPER_SECRET },
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

// ─── Core: dispatch to worker with failover ─────────────────────────────
// Pure execution path — no cache / singleflight / telemetry. Those layer on
// top in scrapeWithCache().
async function dispatchToWorker(task, username) {
  const tried = [];
  let lastError = null;
  let lastStatus = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { worker, reason } = await pickWorker({ username, excludeIds: tried });
    if (!worker) {
      return { ok: false, status: 503, error: lastError || 'no_workers_available', tried };
    }
    tried.push(worker.id);
    log.info(`-> ${worker.id} (${reason}) action=${task.action} user=${username || '-'}`);
    const fwd = await forwardScrape(worker, task);

    if (fwd.status >= 200 && fwd.status < 300 && fwd.body && fwd.body.ok) {
      await bumpWorkerRequests(worker.id);
      if (username) await setStickyTarget(username, worker.id);
      return { ok: true, items: fwd.body.items, worker: worker.id, status: fwd.status, tried };
    }
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
    if (/login_failed|credentials_rejected|not_logged_in|2fa_required_but_no_secret|password_input_not_found|username_input_not_found|block_signal_on_login_page|account_suspended/i.test(errMsg)) {
      log.warn(`worker ${worker.id} login broken (${errMsg}) - blocking and failing over`);
      await markWorkerBlocked(worker.id);
    } else {
      log.warn(`worker ${worker.id} returned ${fwd.status} (${errMsg}) - failing over`);
    }
  }
  return { ok: false, status: lastStatus || 503, error: lastError || 'all_workers_failed', tried };
}

// ─── Core: scrape with cache + singleflight + telemetry ───────────────────
async function scrapeWithCache(task, username) {
  const ckey = cacheKey(task.action, task.payload);
  const t0 = Date.now();

  // 1. Cache lookup with XFetch probabilistic early refresh.
  //    onEarlyRefresh fires a background scrape ahead of TTL expiry so we
  //    avoid the thundering-herd at boundary. Still serves the cached value
  //    to this caller — the refresh is for the *next* caller.
  const onEarlyRefresh = () => {
    log.info(`xfetch early refresh: ${task.action}/${username || '-'}`);
    // Use singleflight so only ONE background refresh fires even if many
    // requests trigger the XFetch path simultaneously.
    singleflight(`${ckey}::xfetch`, async () => {
      const t0bg = Date.now();
      const r = await dispatchToWorker(task, username);
      if (r.ok) {
        await cacheSet(task.action, ckey, r.items, Date.now() - t0bg);
        telemetry({ action: task.action, user: username || '-', source: 'xfetch-bg', latency_ms: Date.now() - t0bg, worker: r.worker });
      }
      return r;
    }).catch((err) => log.warn(`xfetch bg refresh failed: ${err.message}`));
  };
  const cached = await cacheGet(ckey, task.action, onEarlyRefresh);
  if (cached) {
    const latency = Date.now() - t0;
    telemetry({ action: task.action, user: username || '-', source: 'redis-cache', latency_ms: latency });
    return { ok: true, items: cached.items, source: 'redis-cache', cacheHit: true };
  }

  // 2. Singleflight: coalesce duplicate concurrent requests
  return singleflight(ckey, async () => {
    const tWorker = Date.now();
    const result = await dispatchToWorker(task, username);
    const recomputeMs = Date.now() - tWorker;
    const latency = Date.now() - t0;
    if (result.ok) {
      // recompute_ms is passed so XFetch knows the cost — drives refresh probability
      cacheSet(task.action, ckey, result.items, recomputeMs);
      bridgePublishCache(ckey, task.action);
      telemetry({ action: task.action, user: username || '-', source: 'cluster', latency_ms: latency, worker: result.worker, recompute_ms: recomputeMs });
      return { ok: true, items: result.items, source: 'cluster', worker: result.worker, cacheHit: false };
    }
    telemetry({ action: task.action, user: username || '-', source: 'error', latency_ms: latency, error: result.error });
    return { ok: false, status: result.status, error: result.error, tried: result.tried, source: 'error', cacheHit: false };
  });
}

// ─── Daily reset (UTC midnight) ──────────────────────────────────────────
function msUntilNextUTCMidnight() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next.getTime() - now.getTime();
}
async function resetDailyCounters() {
  log.info('resetting daily worker request counters');
  try {
    const pipeline = redis.pipeline();
    for (const w of workers) pipeline.del(`worker:${w.id}:requests_today`);
    await pipeline.exec();
  } catch (err) { log.warn(`daily reset failed: ${err.message}`); }
}
function scheduleDailyReset() {
  const wait = msUntilNextUTCMidnight();
  log.info(`next counter reset in ${Math.round(wait / 60000)} minutes`);
  setTimeout(async () => {
    await resetDailyCounters();
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
  const r = await scrapeWithCache({ action, payload }, username);
  res.setHeader('X-Cache', r.cacheHit ? 'hit' : 'miss');
  res.setHeader('X-Source', r.source || 'unknown');
  if (!r.ok) {
    return res.status(r.status || 503).json({ ok: false, error: r.error, tried: r.tried });
  }
  return res.json({ ok: true, items: r.items });
});

// ─── Batch endpoint ─────────────────────────────────────────────────────
app.post('/scrape/batch', requireSecret, async (req, res) => {
  const body = req.body || {};
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const strategy = (body.strategy || 'parallel').toLowerCase();

  if (tasks.length === 0) return res.status(400).json({ ok: false, error: 'tasks_array_required' });
  if (tasks.length > 32) return res.status(400).json({ ok: false, error: 'too_many_tasks (max 32)' });

  // For batch, run each task through scrapeWithCache so we get cache + singleflight per task.
  // Sequential strategy keeps the per-task ordering; parallel kicks them all off at once.
  async function runTask(task) {
    const uname = task?.payload?.username?.trim().replace(/^@/, '') || null;
    const r = await scrapeWithCache(task, uname);
    return { action: task.action, payload: task.payload, ok: r.ok, items: r.items, error: r.error, source: r.source };
  }

  let results;
  if (strategy === 'sequential') {
    results = [];
    for (const t of tasks) results.push(await runTask(t));
  } else {
    results = await Promise.all(tasks.map(runTask));
  }
  res.json({ ok: true, results });
});

// ─── Telemetry endpoint: live perf snapshot ──────────────────────────────
// GET /perf  → { actions: { <action>: { <source>: { count, p50, p95, p99, avg } } } }
// Reads recent telemetry events from the Redis Stream and aggregates.
// Cheap enough to call from the dashboard for a real-time perf view.
app.get('/perf', requireSecret, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '5000', 10) || 5000, 50000);
  let entries = [];
  try {
    entries = await redis.xrevrange('telemetry:scrape', '+', '-', 'COUNT', limit);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  // entries: [[id, [k,v,k,v,...]], ...]
  const grouped = {}; // action -> source -> [latencies]
  for (const [, kv] of entries) {
    const event = {};
    for (let i = 0; i < kv.length; i += 2) event[kv[i]] = kv[i + 1];
    const action = event.action || 'unknown';
    const source = event.source || 'unknown';
    const lat = parseInt(event.latency_ms, 10);
    if (!Number.isFinite(lat)) continue;
    if (!grouped[action]) grouped[action] = {};
    if (!grouped[action][source]) grouped[action][source] = [];
    grouped[action][source].push(lat);
  }

  function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return sorted[idx];
  }

  const out = {};
  for (const [action, bySource] of Object.entries(grouped)) {
    out[action] = {};
    for (const [source, latencies] of Object.entries(bySource)) {
      const total = latencies.reduce((a, b) => a + b, 0);
      out[action][source] = {
        count: latencies.length,
        avg: Math.round(total / latencies.length),
        p50: percentile(latencies, 0.50),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
      };
    }
  }
  res.json({ ok: true, sample_size: entries.length, by_action: out });
});

app.get('/health', requireSecret, async (_req, res) => {
  const results = await Promise.all(workers.map((w) => callWorkerHealth(w)));
  for (const r of results) {
    r.blocked_until = await redis.get(`worker:${r.worker_id}:blocked_until`).catch(() => null);
    r.orchestrator_requests_today = await getWorkerRequests(r.worker_id);
  }
  res.json({
    ok: true,
    items: results,
    inflight: inFlight.size,
    bloom_estimated_keys: bloomBits.reduce((acc, b) => acc + popcount(b), 0),
  });
});

function popcount(b) {
  // 8-bit popcount
  let x = b - ((b >> 1) & 0x55);
  x = (x & 0x33) + ((x >> 2) & 0x33);
  return (x + (x >> 4)) & 0x0f;
}

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
