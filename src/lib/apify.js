// All follower/profile calls are proxied through /api/apify-proxy (server-side)
// so the Apify token never appears in browser JS bundles.
//
// SPEED PASS v3 — Frontend layer:
//   - Read actions use GET → Vercel edge cache fires (the proxy sets
//     `s-maxage` + `stale-while-revalidate` so warm calls are served from
//     the CDN in ~50ms instead of 13s).
//   - localStorage SWR layer: every successful response is stashed with a
//     timestamp. fetchCached() returns the stash instantly + fires a
//     background revalidation, so the UI is *literally* instant on warm
//     panes even before the edge cache hits.
//   - dataSourceMonitor: every call records which path served it
//     (cluster / redis-cache / apify-fallback / cache:edge / cache:local)
//     so we can inspect window.__amDataSources from devtools.

const READ_ACTIONS_GET = new Set([
  'profile', 'profile-with-posts', 'posts', 'followers', 'following', 'stories',
  'audience_enrichment', 'top_commenters', 'dashboard_load', 'comments',
  'script_studio', 'ad_library',
]);

// Per-action defaults (ms). The cache is *additional* protection on top of
// the edge cache — if the user's network is slow, localStorage still hits
// instantly. Stays in sync with CACHE_PROFILES in apify-proxy.js.
const LOCAL_CACHE_DEFAULTS = {
  profile:              { ttlMs:  60_000, swrMs:  300_000 },
  posts:                { ttlMs:  60_000, swrMs:  300_000 },
  followers:            { ttlMs:  60_000, swrMs:  300_000 },
  following:            { ttlMs:  60_000, swrMs:  300_000 },
  stories:              { ttlMs:  30_000, swrMs:   60_000 },
  top_commenters:       { ttlMs: 120_000, swrMs:  600_000 },
  audience_enrichment:  { ttlMs: 300_000, swrMs:  900_000 },
  dashboard_load:       { ttlMs:  60_000, swrMs:  300_000 },
  comments:             { ttlMs: 120_000, swrMs:  600_000 },
  // Script Studio analyses change very slowly (4h fresh, 24h stale-revalidate)
  script_studio:        { ttlMs: 4 * 60 * 60 * 1000, swrMs: 24 * 60 * 60 * 1000 },
  ad_library:           { ttlMs: 6 * 60 * 60 * 1000, swrMs: 24 * 60 * 60 * 1000 },
};

// ─── observability ─────────────────────────────────────────────────────────
function recordSource(action, payload, source, latencyMs) {
  if (typeof window === 'undefined') return;
  const arr = window.__amDataSources = window.__amDataSources || [];
  arr.push({
    t: Date.now(), action,
    user: payload?.username || payload?.shortcode || null,
    source, latencyMs,
  });
  if (arr.length > 200) arr.shift();
}

// ─── localStorage cache layer ──────────────────────────────────────────────
function cacheKey(action, payload) {
  // Stable key: sort payload entries so { a:1, b:2 } === { b:2, a:1 }
  const norm = Object.entries(payload || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `am:proxy:v3:${action}:${norm}`;
}

function readCache(action, payload) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(action, payload));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== 'number') return null;
    return parsed;
  } catch { return null; }
}

function writeCache(action, payload, items, dataSource) {
  if (typeof window === 'undefined') return;
  try {
    const entry = { t: Date.now(), items, _dataSource: dataSource || null };
    window.localStorage.setItem(cacheKey(action, payload), JSON.stringify(entry));
  } catch {}
}

// ─── core proxy call ───────────────────────────────────────────────────────
// Internal. Returns { items, source }. Source is taken from x-data-source
// header (set by the proxy) so we can tell cluster vs apify-fallback apart.
//
// `payload.context` is propagated to the proxy. Values:
//   'dashboard' → route to Apify path where mapped (provider table)
//   'freetools' → route to cluster path
//   undefined   → cluster (legacy default)
async function callProxyRaw(action, payload) {
  const useGet = READ_ACTIONS_GET.has(action);
  const start = (typeof performance !== 'undefined' ? performance : Date).now();
  let res;
  if (useGet) {
    const qs = new URLSearchParams({ action, payload: JSON.stringify(payload || {}) }).toString();
    res = await fetch(`/api/apify-proxy?${qs}`, { method: 'GET' });
  } else {
    res = await fetch('/api/apify-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
  }
  const end = (typeof performance !== 'undefined' ? performance : Date).now();
  const latencyMs = Math.round(end - start);

  let body;
  try { body = await res.json(); } catch { throw new Error(`Proxy error: HTTP ${res.status}`); }
  if (!res.ok || !body.ok) throw new Error(body.error || `Proxy request failed (${res.status})`);

  // Data source: prefer header, fall back to body field. Augment with
  // Vercel cache header if we hit the edge cache (this is the magic that
  // turns a 13s scrape into a 50ms CDN hit on warm reads).
  const headerSource = res.headers?.get?.('x-data-source') || body._dataSource || 'unknown';
  const vercelCache = res.headers?.get?.('x-vercel-cache') || '';
  const finalSource = (vercelCache === 'HIT' || vercelCache === 'STALE')
    ? `edge-cache:${vercelCache.toLowerCase()}`
    : headerSource;

  recordSource(action, payload, finalSource, latencyMs);
  return { items: body.items, source: finalSource, body };
}

// Default export: same behaviour as before (returns items array). Maintains
// backwards compat with everything that did `await callProxy(...)`. New code
// should prefer callProxyCached for SWR.
async function callProxy(action, payload) {
  const { items, source } = await callProxyRaw(action, payload);
  // Always stash successful responses — even non-SWR callers contribute to
  // the cache, so the next SWR caller gets an instant hit.
  if (items) writeCache(action, payload, items, source);
  return items;
}

/**
 * SWR-style fetch:
 *   1. If fresh cache exists (<ttlMs old): return immediately, no network
 *   2. If stale cache exists (<swrMs old): return immediately AND fire a
 *      background revalidation — onUpdate(newItems) fires when it returns
 *   3. If no cache: await the network call, return result
 *
 * @param {string} action
 * @param {object} payload
 * @param {object} opts - { ttlMs?, swrMs?, onUpdate?, force? }
 * @returns {Promise<Array>} items
 */
export async function callProxyCached(action, payload, opts = {}) {
  const defaults = LOCAL_CACHE_DEFAULTS[action] || { ttlMs: 60_000, swrMs: 300_000 };
  const ttlMs = opts.ttlMs ?? defaults.ttlMs;
  const swrMs = opts.swrMs ?? defaults.swrMs;
  const onUpdate = typeof opts.onUpdate === 'function' ? opts.onUpdate : null;

  const cached = opts.force ? null : readCache(action, payload);
  const now = Date.now();

  if (cached) {
    const age = now - cached.t;
    if (age < ttlMs) {
      // Fresh: serve cache, no revalidation
      recordSource(action, payload, 'cache:local-fresh', 0);
      return cached.items;
    }
    if (age < swrMs) {
      // Stale: serve cache, revalidate in background
      recordSource(action, payload, 'cache:local-stale', 0);
      callProxyRaw(action, payload)
        .then(({ items, source }) => {
          if (items) writeCache(action, payload, items, source);
          if (onUpdate) onUpdate(items);
        })
        .catch((err) => {
          // Silent — we already returned cached value. Log for observability.
          console.warn(`[callProxyCached] background revalidation failed for ${action}:`, err.message);
        });
      return cached.items;
    }
  }

  // No cache or expired beyond SWR window: network call
  const { items, source } = await callProxyRaw(action, payload);
  if (items) writeCache(action, payload, items, source);
  return items;
}

// ─── public API (backwards compatible) ─────────────────────────────────────

/**
 * Fetch Instagram profile data for a public username.
 * Routed through the cluster — Apify fallback has been removed.
 * Returns an array (usually 1 item) with profilePicUrl, stats, etc.
 * NOTE: Does not include latestPosts. Use fetchInstagramProfileWithPosts for that.
 */
export async function fetchInstagramProfile(username) {
  return callProxy('profile', { username: username.replace('@', '') });
}

/** SWR variant. Identical signature except returns instantly from cache when warm. */
export async function fetchInstagramProfileSWR(username, opts) {
  return callProxyCached('profile', { username: username.replace('@', '') }, opts);
}

/**
 * Speed-v5: dashboard-context fetcher. Routes via Apify provider for the
 * faster cold-path. Use from Pulse / Audience / ContentLab / Outreach panes.
 * Returns full profile + 12 latest posts in one call (via profile-with-posts).
 */
export async function fetchDashboardProfile(username, opts) {
  return callProxyCached(
    'profile-with-posts',
    { username: username.replace('@', ''), context: 'dashboard' },
    opts,
  );
}

/** Dashboard posts fetcher (Apify path). */
export async function fetchDashboardPosts(username, limit = 12, opts) {
  return callProxyCached(
    'posts',
    { username: username.replace('@', ''), limit, context: 'dashboard' },
    opts,
  );
}

/** Dashboard top-commenters fetcher (Apify composite path). */
export async function fetchDashboardTopCommenters(username, options = {}, opts) {
  const { postLimit = 6, commentLimit = 50, topN = 25 } = options;
  return callProxyCached(
    'top_commenters',
    {
      username: username.replace('@', ''),
      postLimit, commentLimit, topN,
      context: 'dashboard',
    },
    opts,
  );
}

/**
 * Script Studio analysis: pulls 50 posts and runs the full pipeline
 * (performance buckets + log-odds lexicon + structural blueprint + scripts).
 * Heavy on the cold path (~50s Apify post-scraper) but cached 4h fresh
 * + 24h SWR — so revisits are sub-200ms.
 */
export async function fetchScriptStudio(username, opts) {
  return callProxyCached(
    'script_studio',
    { username: username.replace('@', ''), context: 'dashboard' },
    { ttlMs: 4 * 60 * 60 * 1000, swrMs: 24 * 60 * 60 * 1000, ...opts },
  );
}

/**
 * Meta Ad Library longevity tracker. Pass a Facebook page URL or page ID.
 * Returns ads sorted by days_running with scaling-indicator metadata.
 */
export async function fetchAdLibrary({ pageUrl, pageId, country = 'US', limit = 30 } = {}, opts) {
  const payload = { country, limit, context: 'dashboard' };
  if (pageUrl) payload.pageUrl = pageUrl;
  if (pageId) payload.pageId = pageId;
  return callProxyCached('ad_library', payload, {
    ttlMs: 6 * 60 * 60 * 1000, swrMs: 24 * 60 * 60 * 1000, ...opts,
  });
}

/** Dashboard one-shot loader (profile + posts via Apify, stories + followers via cluster). */
export async function fetchDashboardLoad(username, options = {}) {
  return callProxyCached(
    'dashboard_load',
    {
      username: username.replace('@', ''),
      postLimit: options.postLimit || 12,
      followerLimit: options.followerLimit || 20,
      context: 'dashboard',
    },
    options,
  );
}

/**
 * Fetch Instagram profile data + recent posts via the cluster.
 * The `profile-with-posts` action is now a cluster-composed parallel call
 * (profile + posts merged into one item with a `latestPosts` array).
 * Same return shape as before — backwards compatible.
 */
export async function fetchInstagramProfileWithPosts(username) {
  return callProxy('profile-with-posts', { username: username.replace('@', '') });
}

/** Fetch Instagram Stories for a public username. */
export async function fetchInstagramStories(username) {
  return callProxy('stories', { username: username.replace('@', '') });
}
export async function fetchInstagramStoriesSWR(username, opts) {
  return callProxyCached('stories', { username: username.replace('@', '') }, opts);
}

/**
 * Recent posts with engagement metrics. Cluster-only.
 * @param {string} username
 * @param {number} limit  default 12, max 36
 */
export async function fetchInstagramPosts(username, limit = 12) {
  return callProxy('posts', { username: username.replace('@', ''), limit });
}
export async function fetchInstagramPostsSWR(username, limit = 12, opts) {
  return callProxyCached('posts', { username: username.replace('@', ''), limit }, opts);
}

/**
 * Top commenters across a target's recent posts.
 * @param {string} username
 * @param {object} opts  { postLimit, commentLimit, topN }
 */
export async function fetchTopCommenters(username, opts = {}) {
  const { postLimit = 6, commentLimit = 50, topN = 25 } = opts;
  return callProxy('top_commenters', {
    username: username.replace('@', ''),
    postLimit, commentLimit, topN,
  });
}
export async function fetchTopCommentersSWR(username, opts = {}, swrOpts) {
  const { postLimit = 6, commentLimit = 50, topN = 25 } = opts;
  return callProxyCached('top_commenters', {
    username: username.replace('@', ''),
    postLimit, commentLimit, topN,
  }, swrOpts);
}

/** Audience enrichment: sample N followers + bio + city + hashtags. */
export async function fetchAudienceEnrichment(username, sample = 20, offset = 0) {
  return callProxy('audience_enrichment', {
    username: username.replace('@', ''),
    sample, offset,
  });
}
export async function fetchAudienceEnrichmentSWR(username, sample = 20, offset = 0, opts) {
  return callProxyCached('audience_enrichment', {
    username: username.replace('@', ''),
    sample, offset,
  }, opts);
}

/** Composite: profile + posts in one call (used by Post Viewer). */
export async function fetchProfileWithClusterPosts(username, postLimit = 12) {
  const cleanUser = username.replace('@', '');
  const [profileItems, posts] = await Promise.all([
    callProxy('profile', { username: cleanUser }),
    callProxy('posts', { username: cleanUser, limit: postLimit }),
  ]);
  return {
    profile: (profileItems && profileItems[0]) || null,
    posts: posts || [],
  };
}

/**
 * Fetch followers or following list for a public Instagram account.
 * @param {string} username - Instagram username
 * @param {'followers'|'following'} listType - Which list to fetch
 * @param {number} limit - Max number of users to fetch (default 200)
 */
export async function fetchFollowersList(username, listType = 'followers', limit = 200) {
  return callProxy(listType, { username: username.replace('@', ''), limit });
}
export async function fetchFollowersListSWR(username, listType = 'followers', limit = 200, opts) {
  return callProxyCached(listType, { username: username.replace('@', ''), limit }, opts);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW SCRAPERS (Apify-backed; no SWR variant)
// ═══════════════════════════════════════════════════════════════════════════

/** Fetch comments from an Instagram post URL. */
export async function fetchInstagramComments(postUrl, limit = 50) {
  return callProxy('comments', { postUrl, limit });
}

/** Fetch posts from a Facebook page. */
export async function fetchFacebookPosts(pageUrl, limit = 50) {
  return callProxy('facebook-posts', { pageUrl, limit });
}

/** Fetch TikTok videos from a profile or hashtag. */
export async function fetchTikTokVideos({ username, hashtag, limit = 50 }) {
  return callProxy('tiktok', { username, hashtag, limit });
}

/** Fetch LinkedIn posts from a profile or company page. */
export async function fetchLinkedInPosts(profileUrl, limit = 10) {
  return callProxy('linkedin-posts', { profileUrl, limit });
}

/** Fetch LinkedIn profile data (requires cookies for auth). */
export async function fetchLinkedInProfile(profileUrl, cookies) {
  return callProxy('linkedin-profile', { profileUrl, cookies });
}

/** Fetch YouTube video transcript. */
export async function fetchYouTubeTranscript(videoUrl) {
  return callProxy('youtube-transcript', { videoUrl });
}

// ═══════════════════════════════════════════════════════════════════════════
// Debug helpers (window.__amDataSources, window.amSpeedSummary)
// ═══════════════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.amSpeedSummary = function () {
    const arr = window.__amDataSources || [];
    if (arr.length === 0) {
      console.log('No proxy calls recorded yet.');
      return;
    }
    const byAction = {};
    for (const e of arr) {
      const k = `${e.action}:${e.source}`;
      byAction[k] = byAction[k] || { count: 0, totalMs: 0 };
      byAction[k].count += 1;
      byAction[k].totalMs += e.latencyMs;
    }
    const rows = Object.entries(byAction).map(([k, v]) => ({
      key: k, count: v.count, avgMs: Math.round(v.totalMs / v.count),
    }));
    console.table(rows);
    return rows;
  };
}
