// Vercel Serverless Function: CloakBrowser Scraper Router (+ legacy Apify for non-IG)
//
// INSTAGRAM ACTIONS — 100% cluster-only, ZERO Apify fallback:
//   - profile, profile-with-posts, posts, stories, followers, following,
//     audience_enrichment, top_commenters, comments, dashboard_load
//
// NON-IG ACTIONS — still Apify (no worker cluster for these platforms):
//   - facebook-posts, tiktok, linkedin-posts, linkedin-profile, youtube-transcript
//
// The Hetzner orchestrator on :3001 picks which of the 5 workers handles
// each scrape (sticky-by-username with least-loaded fallback). Per-worker
// failover is built in so an unhealthy worker (1 & 4 currently) doesn't
// break the request.
//
// Observability (added speed-v3):
//   - Every response carries `x-data-source` HTTP header AND `_dataSource`
//     JSON field. Values: cluster | redis-cache | cluster-empty | apify |
//     error. ("apify" only appears on non-IG actions.)
//   - Vercel edge cache: cacheable reads set Cache-Control with
//     stale-while-revalidate. Edge cache only fires for GET requests.
//   - GET support: GET /api/apify-proxy?action=X&payload=URL_ENCODED_JSON.
//
// Env vars (Vercel Settings → Environment Variables):
//   APIFY_TOKEN          — your Apify API token
//   SCRAPER_SERVICE_URL  — Hetzner orchestrator URL (e.g. http://46.224.227.199:3001)
//   SCRAPER_SECRET       — shared secret for orchestrator auth (X-Secret header)

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL;
const SCRAPER_SECRET = process.env.SCRAPER_SECRET;
const BASE = 'https://api.apify.com/v2';

if (!APIFY_TOKEN) console.error('APIFY_TOKEN environment variable is not configured');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Profile field normalization
// ─────────────────────────────────────────────────────────────────────────────
// The cluster scraper returns IG-style snake-ish keys: followers, following,
// posts, bio, isVerified, isPrivate, fullName, profilePicUrl. The UI mostly
// reads camelCase "...Count" variants. We alias everything in BOTH directions
// so a consumer can read either form. This keeps the StoryViewer / PostViewer
// / Pulse KPIs all rendering the right values.
function normalizeProfile(p) {
  if (!p || typeof p !== 'object') return p;
  const followers = p.followersCount ?? p.followers ?? p.follower_count ?? null;
  const following = p.followingCount ?? p.following ?? p.followsCount ?? p.follow_count ?? null;
  const posts     = p.postsCount     ?? p.posts     ?? p.media_count    ?? null;
  return {
    ...p,
    username: p.username,
    fullName: p.fullName || p.full_name || null,
    biography: p.biography || p.bio || null,
    bio: p.bio || p.biography || null,
    // Count aliases — every legacy consumer covered
    followers,
    followersCount: followers,
    following,
    followingCount: following,
    followsCount: following,
    posts,
    postsCount: posts,
    // Verification/private aliases
    isVerified: !!(p.isVerified ?? p.is_verified ?? p.verified),
    verified:   !!(p.isVerified ?? p.is_verified ?? p.verified),
    isPrivate:  !!(p.isPrivate  ?? p.is_private  ?? p.private),
    private:    !!(p.isPrivate  ?? p.is_private  ?? p.private),
    // Avatar aliases
    profilePicUrl:   p.profilePicUrl || p.profile_pic_url || p.profile_pic_url_hd || null,
    profilePicUrlHD: p.profilePicUrlHD || p.profile_pic_url_hd || p.profilePicUrl || p.profile_pic_url || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Observability + cache helpers
// ─────────────────────────────────────────────────────────────────────────────
// Returns a JSON body augmented with _dataSource and ensures the
// x-data-source header is set. Centralizing this keeps every action
// observable from Safari devtools (Network tab → headers).
function withSource(res, source, body) {
  try { res.setHeader('x-data-source', source); } catch {}
  return { ...body, _dataSource: source };
}

// Edge cache profile per action. s-maxage = fresh window served from cache;
// stale-while-revalidate = grace period during which a stale value is served
// while the cache revalidates in the background.
//
// Values picked to balance freshness with hiding worst-case scrape latency:
//   profile / posts:           60s fresh, 5 min SWR
//   top_commenters / audience: 120s fresh, 10 min SWR (heavy, slow to compute)
//   stories:                   30s fresh, 1 min SWR (changes hourly)
//   followers / following:     60s fresh, 5 min SWR
const CACHE_PROFILES = {
  profile:              { sMax:  60, swr: 300 },
  posts:                { sMax:  60, swr: 300 },
  followers:            { sMax:  60, swr: 300 },
  following:            { sMax:  60, swr: 300 },
  stories:              { sMax:  30, swr:  60 },
  top_commenters:       { sMax: 120, swr: 600 },
  audience_enrichment:  { sMax: 300, swr: 900 },
  dashboard_load:       { sMax:  60, swr: 300 },
  comments:             { sMax: 120, swr: 600 },
};

function setEdgeCache(res, action) {
  const p = CACHE_PROFILES[action];
  if (!p) return;
  // s-maxage targets Vercel edge cache (CDN-Cache-Control also recognized).
  // public is required for the CDN to cache. We pin max-age=0 so end-user
  // browsers always revalidate (the frontend can layer its own SWR on top).
  const directive = `public, max-age=0, s-maxage=${p.sMax}, stale-while-revalidate=${p.swr}`;
  try {
    res.setHeader('Cache-Control', directive);
    res.setHeader('CDN-Cache-Control', directive);
    res.setHeader('Vercel-CDN-Cache-Control', directive);
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CloakBrowser scraper service proxy
// ─────────────────────────────────────────────────────────────────────────────
// Returns { items, source } where source is 'cluster' or 'redis-cache' based
// on orchestrator response headers. The orchestrator sets `x-cache: hit|miss`
// when the Redis layer is wired up; we propagate that distinction to the edge.
async function callScraperService(action, payload) {
  if (!SCRAPER_SERVICE_URL) {
    throw new Error('SCRAPER_SERVICE_URL is not configured. Set it to your Hetzner orchestrator URL (e.g. http://IP:3001) in Vercel env vars.');
  }

  const r = await fetch(`${SCRAPER_SERVICE_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {}),
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || !body.ok) throw new Error(body.error || `Scraper service error (${r.status})`);
  const cacheHeader = r.headers.get('x-cache') || r.headers.get('X-Cache');
  const source = cacheHeader === 'hit' ? 'redis-cache' : 'cluster';
  return { items: body.items, source };
}

// ─── Cluster batch call ─────────────────────────────────────────────────
// Fans tasks across multiple workers via /scrape/batch. Per-task failures
// don't fail the whole call.
async function callScraperBatch(tasks, strategy = 'parallel') {
  if (!SCRAPER_SERVICE_URL) throw new Error('SCRAPER_SERVICE_URL is not configured');
  const r = await fetch(`${SCRAPER_SERVICE_URL}/scrape/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {}),
    },
    body: JSON.stringify({ tasks, strategy }),
  });
  const body = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(body.error || `Scraper batch error (${r.status})`);
  if (!body.results) throw new Error('Scraper batch returned no results');
  return body.results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apify helpers
// ─────────────────────────────────────────────────────────────────────────────
async function startRun(actorId, input) {
  const r = await fetch(
    `${BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Failed to start actor (${r.status}): ${text}`);
  }
  const { data } = await r.json();
  return data;
}

async function pollRun(runId, maxWaitMs = 110000, intervalMs = 4000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const r = await fetch(`${BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Failed to poll run status (${r.status}): ${text}`);
    }
    const { data } = await r.json();
    if (!data) throw new Error('Empty response while polling run status');
    if (data.status === 'SUCCEEDED') return data;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(data.status)) {
      throw new Error(`Actor run ${data.status}${data.statusMessage ? `: ${data.statusMessage}` : ''}`);
    }
  }
  throw new Error('Timed out waiting for actor run — try a smaller limit.');
}

async function getDatasetItems(datasetId, limit = 200) {
  const r = await fetch(
    `${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=${limit}`
  );
  if (!r.ok) throw new Error(`Failed to fetch dataset: ${r.status}`);
  const items = await r.json();
  if (Array.isArray(items) && items.length === 1 && items[0]?.status === 'free_tier_limit_reached') {
    throw new Error('Apify free tier limit reached. The Instagram scraper service handles this — ensure SCRAPER_SERVICE_URL is configured.');
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request parsing — supports both POST (body) and GET (query string)
// ─────────────────────────────────────────────────────────────────────────────
function parseRequest(req) {
  if (req.method === 'GET') {
    const action = req.query?.action;
    let payload = {};
    if (req.query?.payload) {
      try { payload = JSON.parse(req.query.payload); }
      catch { payload = {}; }
    } else {
      // Also accept flat query params (e.g. ?action=profile&username=nasa)
      const { action: _a, payload: _p, ...rest } = req.query || {};
      for (const [k, v] of Object.entries(rest)) {
        // Coerce numeric strings that look like numbers
        const n = Number(v);
        payload[k] = Number.isFinite(n) && String(n) === String(v) ? n : v;
      }
    }
    return { action, payload };
  }
  return { action: req.body?.action, payload: req.body?.payload || {} };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'x-data-source, x-vercel-cache');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, payload = {} } = parseRequest(req);
  if (!action) return res.status(400).json({ error: 'Missing action' });

  // ── Internal: /perf passthrough (Phase 8 observability) ────────────────
  // GET /api/apify-proxy?action=_perf  → returns the orchestrator's live
  // p50/p95/p99 per (action, source) from its telemetry stream.
  if (action === '_perf') {
    if (!SCRAPER_SERVICE_URL) {
      return res.status(503).json({ error: 'SCRAPER_SERVICE_URL not configured' });
    }
    try {
      const url = `${SCRAPER_SERVICE_URL}/perf?limit=${payload.limit || 5000}`;
      const r = await fetch(url, {
        headers: SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {},
      });
      const body = await r.json();
      // Short cache so dashboards can poll without hammering the orchestrator
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=5');
      return res.status(r.status).json(body);
    } catch (err) {
      return res.status(502).json({ error: `orchestrator unreachable: ${err.message}` });
    }
  }

  try {
    let run, completed, items;

    // ── ROUTED TO CLOAKBROWSER CLUSTER (no Apify fallback) ──────────────────

    if (action === 'followers') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('followers', { username, limit });
      setEdgeCache(res, 'followers');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items }));
    }

    if (action === 'following') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('following', { username, limit });
      setEdgeCache(res, 'following');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items }));
    }

    if (action === 'stories') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('stories', { username });
      setEdgeCache(res, 'stories');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items }));
    }

    // profile: CLUSTER-ONLY. Apify fallback removed.
    // Field normalization: the cluster returns { followers, following, posts,
    // bio, isVerified, isPrivate, fullName, profilePicUrl } but the UI reads
    // { followersCount, followingCount, postsCount, biography, verified,
    // private, fullName, profilePicUrlHD }. We alias here so every UI path
    // (PostViewer, StoryViewer, Pulse KPIs) finds what it expects.
    if (action === 'profile') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('profile', { username });
      if (!r.items || r.items.length === 0) {
        res.setHeader('x-data-source', 'error');
        return res.status(502).json({ ok: false, error: 'Cluster returned empty profile', _dataSource: 'error' });
      }
      const p = r.items[0];
      const normalized = [normalizeProfile(p)];
      setEdgeCache(res, 'profile');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: normalized }));
    }

    // profile-with-posts: CLUSTER-ONLY. Apify path removed — we now compose
    // the response from parallel cluster `profile` + `posts` calls. The
    // resulting item has the same shape Post Viewer expects (latestPosts).
    if (action === 'profile-with-posts') {
      const { username, postLimit = 12 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const cleanUser = username.replace('@', '');
      const tasks = [
        { action: 'profile', payload: { username: cleanUser } },
        { action: 'posts',   payload: { username: cleanUser, limit: postLimit } },
      ];
      const results = await callScraperBatch(tasks, 'parallel');
      const profileRes = results.find((r) => r.action === 'profile');
      const postsRes   = results.find((r) => r.action === 'posts');
      if (!profileRes?.ok || !profileRes?.items?.length) {
        res.setHeader('x-data-source', 'error');
        return res.status(502).json({ ok: false, error: 'Cluster returned empty profile', _dataSource: 'error' });
      }
      const p = profileRes.items[0];
      // Shape: legacy Apify consumers expect a single item with latestPosts
      // embedded plus the standard profile keys. Synthesize that.
      const merged = [{
        ...normalizeProfile(p),
        latestPosts: postsRes?.items || [],
      }];
      setEdgeCache(res, 'profile');
      return res.status(200).json(withSource(res, 'cluster', { ok: true, items: merged }));
    }

    if (action === 'posts') {
      const { username, limit = 12 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('posts', { username: username.replace('@', ''), limit });
      setEdgeCache(res, 'posts');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items }));
    }

    if (action === 'audience_enrichment') {
      const { username, sample = 20, offset = 0 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('audience_enrichment', {
        username: username.replace('@', ''), sample, offset,
      });
      setEdgeCache(res, 'audience_enrichment');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items }));
    }

    // top_commenters: CLUSTER-ONLY. The inline Apify fallback for missed-post
    // comments was removed — if the cluster comments scraper misses, we now
    // report it via clusterEmpty count and the UI shows whatever commenters
    // came back from the posts the cluster DID succeed on. No silent slowness.
    if (action === 'top_commenters') {
      const { username, postLimit = 6, commentLimit = 50, topN = 25 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const cleanUser = username.replace('@', '');
      const postsResp = await callScraperService('posts', { username: cleanUser, limit: postLimit });
      const posts = postsResp.items;
      if (!posts || posts.length === 0) {
        setEdgeCache(res, 'top_commenters');
        return res.status(200).json(withSource(res, postsResp.source, { ok: true, items: [] }));
      }

      const tasks = posts.map((p) => ({
        action: 'comments',
        payload: { shortcode: p.shortcode, limit: commentLimit },
      }));
      const clusterResults = await callScraperBatch(tasks, 'parallel');

      // Count empties so the UI knows when the cluster comments scraper is
      // struggling on a handle (and operator knows to investigate comments.js).
      let clusterHits = 0;
      let clusterEmpty = 0;
      for (let i = 0; i < posts.length; i++) {
        const r = clusterResults[i];
        if (r && r.ok && Array.isArray(r.items) && r.items.length > 0) clusterHits += 1;
        else clusterEmpty += 1;
      }

      // Aggregate commenters from cluster-only results
      const tally = new Map();
      for (const r of clusterResults) {
        if (!r || !r.ok || !Array.isArray(r.items)) continue;
        for (const c of r.items) {
          const u = c.username || c.owner?.username;
          if (!u || u === cleanUser) continue;
          const cur = tally.get(u) || {
            username: u,
            fullName: c.fullName || c.owner?.full_name || null,
            profilePicUrl: c.profilePicUrl || c.owner?.profile_pic_url || null,
            isVerified: !!(c.isVerified || c.owner?.is_verified),
            commentCount: 0,
            totalLikes: 0,
            samples: [],
          };
          cur.commentCount += 1;
          cur.totalLikes += (c.likeCount ?? 0);
          const txt = c.text || '';
          if (cur.samples.length < 3 && txt) cur.samples.push(String(txt).slice(0, 240));
          tally.set(u, cur);
        }
      }
      const ranked = Array.from(tally.values())
        .sort((a, b) => b.commentCount - a.commentCount || b.totalLikes - a.totalLikes)
        .slice(0, topN);

      setEdgeCache(res, 'top_commenters');
      return res.status(200).json(withSource(res, postsResp.source, {
        ok: true,
        items: ranked,
        postsFetched: posts.length,
        clusterHits,
        clusterEmpty,
      }));
    }

    // dashboard_load: parallel fan-out of profile + posts + followers + stories.
    if (action === 'dashboard_load') {
      const { username, postLimit = 12, followerLimit = 20 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const cleanUser = username.replace('@', '');
      const tasks = [
        { action: 'profile',   payload: { username: cleanUser } },
        { action: 'posts',     payload: { username: cleanUser, limit: postLimit } },
        { action: 'followers', payload: { username: cleanUser, limit: followerLimit } },
        { action: 'stories',   payload: { username: cleanUser } },
      ];
      const results = await callScraperBatch(tasks, 'parallel');
      const byAction = {};
      for (const r of results) {
        byAction[r.action] = { ok: r.ok, items: r.items || [], error: r.error };
      }
      setEdgeCache(res, 'dashboard_load');
      return res.status(200).json(withSource(res, 'cluster', { ok: true, byAction }));
    }

    // comments: CLUSTER-ONLY. Apify fallback removed. Returns [] if the
    // cluster can't capture comments — the frontend treats empty as
    // "no commenters extracted" rather than waiting 30s on Apify.
    if (action === 'comments') {
      const { postUrl, shortcode, limit = 50 } = payload;
      if (!postUrl && !shortcode) return res.status(400).json({ error: 'Missing postUrl or shortcode' });
      const clusterPayload = shortcode ? { shortcode, limit } : { url: postUrl, limit };
      try {
        const r = await callScraperService('comments', clusterPayload);
        setEdgeCache(res, 'comments');
        return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items || [] }));
      } catch (err) {
        console.warn(`[comments] Cluster failed: ${err.message}`);
        setEdgeCache(res, 'comments');
        return res.status(200).json(withSource(res, 'cluster-empty', {
          ok: true, items: [], clusterError: err.message,
        }));
      }
    }

    // ── APIFY ACTORS (non-IG, no worker cluster available) ──────────────────
    // These platforms don't have a worker cluster yet. Listed clearly so the
    // operator can see exactly what still touches Apify: Facebook, TikTok,
    // LinkedIn, YouTube. All Instagram actions are now cluster-only.
    if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });

    if (action === 'facebook-posts') {
      const { pageUrl, limit = 50 } = payload;
      if (!pageUrl) return res.status(400).json({ error: 'Missing pageUrl' });
      run = await startRun('apify/facebook-posts-scraper', {
        startUrls: [{ url: pageUrl }],
        resultsLimit: limit,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json(withSource(res, 'apify', { ok: true, items }));
    }

    if (action === 'tiktok') {
      const { username, hashtag, limit = 50 } = payload;
      if (!username && !hashtag) return res.status(400).json({ error: 'Missing username or hashtag' });
      const input = { resultsPerPage: limit };
      if (username) input.profiles = [username.replace('@', '')];
      if (hashtag) input.hashtags = [hashtag.replace('#', '')];
      run = await startRun('clockworks/tiktok-scraper', input);
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json(withSource(res, 'apify', { ok: true, items }));
    }

    if (action === 'linkedin-posts') {
      const { profileUrl, limit = 10 } = payload;
      if (!profileUrl) return res.status(400).json({ error: 'Missing profileUrl' });
      run = await startRun('supreme_coder/linkedin-post', {
        urls: [profileUrl],
        limitPerSource: limit,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json(withSource(res, 'apify', { ok: true, items }));
    }

    if (action === 'linkedin-profile') {
      const { profileUrl, cookies } = payload;
      if (!profileUrl) return res.status(400).json({ error: 'Missing profileUrl' });
      if (!cookies || !Array.isArray(cookies)) {
        return res.status(400).json({ error: 'Missing cookies array (LinkedIn auth required)' });
      }
      run = await startRun('curious_coder/linkedin-profile-scraper', {
        urls: [profileUrl],
        cookie: cookies,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json(withSource(res, 'apify', { ok: true, items }));
    }

    if (action === 'youtube-transcript') {
      const { videoUrl } = payload;
      if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });
      run = await startRun('pintostudio/youtube-transcript-scraper', {
        videoUrl: videoUrl,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json(withSource(res, 'apify', { ok: true, items }));
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Proxy error:', err);
    res.setHeader('x-data-source', 'error');
    return res.status(500).json({ error: err.message || 'Internal error', _dataSource: 'error' });
  }
}
