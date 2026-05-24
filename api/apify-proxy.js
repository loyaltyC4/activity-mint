// Vercel Serverless Function: Apify Actor Proxy + CloakBrowser Scraper Router
//
// Routes:
//   - followers, following, stories, profile, posts, audience_enrichment,
//     top_commenters, dashboard_load → CloakBrowser scraper cluster (Hetzner)
//   - profile-with-posts → Apify (needed for latestPosts)
//   - comments → cluster first, instrumented Apify fallback
//   - facebook, tiktok, linkedin, youtube → Apify actors
//
// The Hetzner orchestrator on :3001 is responsible for picking which of the 5
// workers handles each scrape (sticky-by-username with least-loaded fallback).
//
// SPEED PASS v3:
//   - Observability: every read response carries `x-data-source` HTTP header
//     AND `_dataSource` JSON field. Values: cluster | redis-cache | apify |
//     apify-fallback | apify-partial | error.
//   - Apify fallback REMOVED from `profile` action (cluster is reliable).
//     If cluster fails, we return 502 — no more silent 60s Apify wait.
//   - Vercel edge cache: cacheable read actions set Cache-Control with
//     stale-while-revalidate. Edge cache only fires for GET requests.
//   - GET support: GET /api/apify-proxy?action=X&payload=URL_ENCODED_JSON
//     enables Vercel edge cache. POST still works.
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

    // profile: CLUSTER-ONLY. Apify fallback removed — cluster is reliable
    // and the 60s Apify polling cost was the user's silent slowness.
    // If cluster fails, return 502 so the frontend can show a real error.
    if (action === 'profile') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const r = await callScraperService('profile', { username });
      if (!r.items || r.items.length === 0) {
        res.setHeader('x-data-source', 'error');
        return res.status(502).json({ ok: false, error: 'Cluster returned empty profile', _dataSource: 'error' });
      }
      const p = r.items[0];
      const normalized = [{
        ...p,
        profilePicUrlHD: p.profilePicUrl,
        followsCount: p.followingCount,
        verified: p.isVerified,
        private: p.isPrivate,
      }];
      setEdgeCache(res, 'profile');
      return res.status(200).json(withSource(res, r.source, { ok: true, items: normalized }));
    }

    // profile-with-posts: Apify-only — used by Post Viewer for latestPosts.
    // The cluster posts action covers most needs; this is the holdout.
    if (action === 'profile-with-posts') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });
      run = await startRun('apify/instagram-profile-scraper', {
        usernames: [username.replace('@', '')],
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json(withSource(res, 'apify', { ok: true, items }));
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

    // top_commenters: cluster posts + cluster comments batch, with INSTRUMENTED
    // Apify fallback for missed posts. Each fallback call is logged AND the
    // response reports how many posts needed Apify rescue so we can monitor
    // cluster comments-scraper reliability over time.
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

      // Track which posts the cluster failed on — these go through Apify.
      const needsFallback = [];
      for (let i = 0; i < posts.length; i++) {
        const r = clusterResults[i];
        if (!r || !r.ok || !Array.isArray(r.items) || r.items.length === 0) {
          needsFallback.push({ idx: i, post: posts[i] });
        }
      }
      let apifyHits = 0;
      let apifyFails = 0;
      if (needsFallback.length > 0 && APIFY_TOKEN) {
        const apifyResults = await Promise.all(needsFallback.map(async (nf) => {
          try {
            const url = `https://www.instagram.com/p/${nf.post.shortcode}/`;
            const r2 = await startRun('apify/instagram-comment-scraper', {
              directUrls: [url], resultsLimit: commentLimit,
            });
            const c = await pollRun(r2.id);
            const itx = await getDatasetItems(c.defaultDatasetId, commentLimit);
            apifyHits += 1;
            return { idx: nf.idx, items: itx };
          } catch (err) {
            apifyFails += 1;
            console.warn(`[top_commenters] Apify fallback for ${nf.post.shortcode} failed: ${err.message}`);
            return { idx: nf.idx, items: [] };
          }
        }));
        for (const ar of apifyResults) {
          clusterResults[ar.idx] = { ok: true, items: ar.items };
        }
      }

      // Aggregate commenters
      const tally = new Map();
      for (const r of clusterResults) {
        if (!r || !r.ok || !Array.isArray(r.items)) continue;
        for (const c of r.items) {
          const u = c.username || c.ownerUsername || c.owner?.username;
          if (!u || u === cleanUser) continue;
          const cur = tally.get(u) || {
            username: u,
            fullName: c.fullName || c.owner?.full_name || null,
            profilePicUrl: c.profilePicUrl || c.ownerProfilePicUrl || c.owner?.profile_pic_url || null,
            isVerified: !!(c.isVerified || c.owner?.is_verified),
            commentCount: 0,
            totalLikes: 0,
            samples: [],
          };
          cur.commentCount += 1;
          cur.totalLikes += (c.likeCount ?? c.likesCount ?? 0);
          const txt = c.text || '';
          if (cur.samples.length < 3 && txt) cur.samples.push(String(txt).slice(0, 240));
          tally.set(u, cur);
        }
      }
      const ranked = Array.from(tally.values())
        .sort((a, b) => b.commentCount - a.commentCount || b.totalLikes - a.totalLikes)
        .slice(0, topN);

      // Source labeling:
      //   - all cluster:     'cluster'  / 'redis-cache' (from postsResp)
      //   - some Apify hits: 'apify-partial' (cluster + Apify fallback)
      //   - all Apify hits:  'apify-fallback' (cluster posts but all comments via Apify)
      let source = postsResp.source;
      if (apifyHits > 0) {
        source = (apifyHits === posts.length) ? 'apify-fallback' : 'apify-partial';
      }
      setEdgeCache(res, 'top_commenters');
      return res.status(200).json(withSource(res, source, {
        ok: true,
        items: ranked,
        postsFetched: posts.length,
        clusterHits: posts.length - apifyHits,
        apifyHits,
        apifyFails,
        fallbackUsed: needsFallback.length,
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

    // ── APIFY ACTORS (working fine, but instrumented) ───────────────────────
    if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });

    // comments: cluster first (fast, free). Instrumented Apify fallback only
    // when cluster fails. Response reports which source served the data so
    // we can monitor cluster comments-scraper reliability.
    if (action === 'comments') {
      const { postUrl, shortcode, limit = 50 } = payload;
      if (!postUrl && !shortcode) return res.status(400).json({ error: 'Missing postUrl or shortcode' });

      // Cluster attempt
      let clusterErr = null;
      if (SCRAPER_SERVICE_URL) {
        try {
          const clusterPayload = shortcode ? { shortcode, limit } : { url: postUrl, limit };
          const r = await callScraperService('comments', clusterPayload);
          if (r.items && r.items.length > 0) {
            setEdgeCache(res, 'comments');
            return res.status(200).json(withSource(res, r.source, { ok: true, items: r.items }));
          }
        } catch (err) {
          clusterErr = err.message;
          console.warn(`[comments] Cluster failed: ${err.message}`);
        }
      }

      // Apify fallback — explicitly labeled so the frontend can see it
      console.log(`[comments] Falling back to Apify (cluster_err=${clusterErr || 'empty'})`);
      const apifyUrl = postUrl || `https://www.instagram.com/p/${shortcode}/`;
      run = await startRun('apify/instagram-comment-scraper', {
        directUrls: [apifyUrl],
        resultsLimit: limit,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      setEdgeCache(res, 'comments');
      return res.status(200).json(withSource(res, 'apify-fallback', {
        ok: true, items, clusterError: clusterErr,
      }));
    }

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
