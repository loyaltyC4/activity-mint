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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;  // Phase H: optional LLM
const BASE = 'https://api.apify.com/v2';

// Script Studio backend — performance calc + NLP. Vercel ESM relative import.
import scriptStudio from './_lib/scriptStudio.js';
// Content deconstruction engine — breaks posts into reproducible template schemas.
import contentDeconstruct from './_lib/contentDeconstruct.js';

// ─────────────────────────────────────────────────────────────────────────────
// Phase H: LLM script generation (optional, gated on ANTHROPIC_API_KEY)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generate 3 fully-written scripts using Claude Haiku. Returns null if
 * ANTHROPIC_API_KEY isn't set. Uses the structural blueprint + lexicon as
 * the system prompt so output mirrors the user's winning style.
 */
async function llmGenerateScripts({ blueprint, lexicon, samples, topic = null }) {
  if (!ANTHROPIC_API_KEY) return null;
  const topWinners = (lexicon?.winners || []).slice(0, 8).map((w) => w.phrase);
  const topLosers  = (lexicon?.losers  || []).slice(0, 8).map((l) => l.phrase);
  const winnerSamples = (samples?.winners || []).slice(0, 2)
    .map((s) => `- "${(s.caption || '').slice(0, 200)}" (Δ_P=${s.delta?.toFixed(2)})`).join('\n');
  const sys = [
    'You are a copywriting analyst. You will receive a quantitative analysis of an',
    'Instagram account and must produce three fully-written caption scripts that',
    'mirror the WINNING patterns in the analysis.',
    '',
    `Common opener style: ${blueprint?.common_opener?.label || 'plain statement'} (${Math.round((blueprint?.common_opener?.share || 0) * 100)}% of winners).`,
    `Common ending style: ${blueprint?.common_ending?.id || 'none'} (${Math.round((blueprint?.common_ending?.share || 0) * 100)}% of winners).`,
    `Avg winning caption length: ${blueprint?.avg_length || 300} chars.`,
    `Uses bulleted lists: ${Math.round((blueprint?.uses_bullets_share || 0) * 100)}% of winners.`,
    '',
    'High-traction phrases (USE THESE where natural):',
    topWinners.length ? topWinners.map((w) => `  - "${w}"`).join('\n') : '  (none identified)',
    '',
    'Dead phrases (AVOID these):',
    topLosers.length ? topLosers.map((l) => `  - "${l}"`).join('\n') : '  (none identified)',
    '',
    'Reference winning posts from this account:',
    winnerSamples || '  (none)',
    '',
    'Output: EXACTLY 3 caption scripts, separated by "\\n---\\n". No commentary.',
    'Each script should mirror the winning structure (opener style, length, ending).',
    topic ? `Topic to write about: ${topic}` : 'Choose 3 different angles relevant to the account.',
  ].join('\n');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: 'Generate the 3 scripts now.' }],
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.warn(`[llm] Anthropic ${resp.status}: ${errBody.slice(0, 200)}`);
      return null;
    }
    const body = await resp.json();
    const text = body?.content?.[0]?.text || '';
    return text.split(/\n---\n/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  } catch (err) {
    console.warn(`[llm] exception: ${err.message}`);
    return null;
  }
}

if (!APIFY_TOKEN) console.error('APIFY_TOKEN environment variable is not configured');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Speed-v5: dual-path provider routing
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard context → Apify path for actions where Apify is faster/more
// scalable. Free tools → cluster (HD media, session-state, sub-ms cache hits).
// Stories stay on cluster regardless because cluster reels_media is 1-2s.
// Speed-v7: Apify tokens exhausted. ALL Instagram actions routed through
// cluster workers (Hetzner, self-hosted, $0/call). Apify reserved ONLY for
// ad_library (no cluster equivalent) and script_studio/deconstruct_profile
// (which need 50-post deep scrape — cluster does 12 max via GraphQL).
// The caching stack (Redis + Bloom + singleflight + XFetch + edge cache)
// still sits on top so warm reads are sub-second regardless of provider.
const PROVIDER_MAP = {
  dashboard: {
    profile:              'cluster',
    'profile-with-posts': 'cluster',
    posts:                'cluster',
    top_commenters:       'cluster',
    comments:             'cluster',
    dashboard_load:       'cluster',
    stories:              'cluster',
    followers:            'cluster',
    following:            'cluster',
    audience_enrichment:  'cluster',
    // These still use Apify — no cluster equivalent or need >12 posts:
    // ad_library, script_studio, deconstruct_profile (handled separately)
  },
  freetools: {
    // Free tools are session-aware and want HD media — always cluster.
    profile:              'cluster',
    'profile-with-posts': 'cluster',
    posts:                'cluster',
    stories:              'cluster',
    comments:             'cluster',
    followers:            'cluster',
    following:            'cluster',
  },
};

function resolveProvider(action, context) {
  const map = PROVIDER_MAP[context];
  return map?.[action] || 'cluster';
}

// Convert Apify profile-scraper item shape to our normalized profile shape.
// Apify returns: { username, fullName, followersCount, followsCount,
// postsCount, biography, verified, private, profilePicUrlHD, latestPosts }
// Our normalized shape (per normalizeProfile in this file) accepts both
// camelCase and snake_case so this is mostly a pass-through.
function normalizeApifyProfile(p) {
  if (!p || typeof p !== 'object') return p;
  return {
    username: p.username,
    fullName: p.fullName || p.full_name || null,
    biography: p.biography || null,
    bio: p.biography || null,
    followers: p.followersCount ?? null,
    followersCount: p.followersCount ?? null,
    following: p.followsCount ?? p.followingCount ?? null,
    followingCount: p.followsCount ?? p.followingCount ?? null,
    followsCount: p.followsCount ?? p.followingCount ?? null,
    posts: p.postsCount ?? null,
    postsCount: p.postsCount ?? null,
    isVerified: !!p.verified,
    verified: !!p.verified,
    isPrivate: !!p.private,
    private: !!p.private,
    profilePicUrl: p.profilePicUrlHD || p.profilePicUrl || null,
    profilePicUrlHD: p.profilePicUrlHD || p.profilePicUrl || null,
    externalUrl: p.externalUrl || null,
    category: p.businessCategoryName || p.category || null,
    // Pass-through latestPosts when present (the profile-scraper bundles them)
    latestPosts: Array.isArray(p.latestPosts) ? p.latestPosts.map(normalizeApifyPost) : undefined,
  };
}

// Apify post item shape → our post shape. Picks HD media URLs the same way
// the cluster does.
function normalizeApifyPost(p) {
  if (!p || typeof p !== 'object') return p;
  // Apify gives displayUrl + images[] + videoUrl directly.
  const imageHD = p.displayUrl || (Array.isArray(p.images) && p.images[0]) || null;
  return {
    shortcode: p.shortCode || p.shortcode || null,
    url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
    type: p.type === 'Video' ? 'video' : (p.type === 'Sidecar' ? 'carousel' : 'image'),
    likes: p.likesCount ?? 0,
    comments: p.commentsCount ?? 0,
    videoViews: p.videoViewCount ?? p.videoPlayCount ?? 0,
    caption: p.caption || null,
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    mentions: Array.isArray(p.mentions) ? p.mentions : [],
    timestamp: p.timestamp || null,
    mediaUrl: p.videoUrl || imageHD,
    thumbnailUrl: imageHD,
    imageUrlHD: imageHD,
    videoUrlHD: p.videoUrl || null,
    isVideo: p.type === 'Video',
    isCarousel: p.type === 'Sidecar',
    carouselItems: Array.isArray(p.childPosts)
      ? p.childPosts.map((c) => ({
          mediaType: c.type === 'Video' ? 'video' : 'image',
          imageUrl: c.displayUrl || (Array.isArray(c.images) && c.images[0]) || null,
          videoUrl: c.videoUrl || null,
        }))
      : null,
  };
}

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
// Speed-v7: edge cache TTLs bumped to match orchestrator. Target: >90%
// of requests served from edge (50ms) or orchestrator Redis (3ms).
const CACHE_PROFILES = {
  profile:              { sMax: 300, swr: 900 },
  'profile-with-posts': { sMax: 300, swr: 900 },
  posts:                { sMax: 300, swr: 900 },
  followers:            { sMax: 180, swr: 600 },
  following:            { sMax: 180, swr: 600 },
  stories:              { sMax:  90, swr: 300 },
  top_commenters:       { sMax: 300, swr: 900 },
  audience_enrichment:  { sMax: 600, swr: 1800 },
  dashboard_load:       { sMax: 300, swr: 900 },
  comments:             { sMax: 180, swr: 600 },
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

    // profile: provider-routed. Apify path on dashboard context.
    if (action === 'profile' && resolveProvider('profile', payload.context) === 'apify') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      try {
        run = await startRun('apify/instagram-profile-scraper', { usernames: [username.replace('@', '')] });
        completed = await pollRun(run.id);
        const raw = await getDatasetItems(completed.defaultDatasetId, 1);
        const normalized = (raw || []).map(normalizeApifyProfile);
        setEdgeCache(res, 'profile');
        return res.status(200).json(withSource(res, 'apify', { ok: true, items: normalized }));
      } catch (err) {
        console.warn(`[profile via apify] failed: ${err.message}, falling back to cluster`);
        // Fall through to cluster path below
      }
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

    // profile-with-posts via Apify: ONE call returns profile + 12 latest posts.
    // This is the killer Apify path — single 6s call vs cluster's 13s composite.
    if (action === 'profile-with-posts' && resolveProvider('profile-with-posts', payload.context) === 'apify') {
      const { username, postLimit = 12 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      try {
        run = await startRun('apify/instagram-profile-scraper', {
          usernames: [username.replace('@', '')],
          resultsLimit: postLimit,
        });
        completed = await pollRun(run.id);
        const raw = await getDatasetItems(completed.defaultDatasetId, 1);
        if (!raw || raw.length === 0) {
          res.setHeader('x-data-source', 'apify-empty');
          return res.status(502).json({ ok: false, error: 'Apify returned empty profile', _dataSource: 'apify-empty' });
        }
        // normalizeApifyProfile already includes latestPosts converted to our shape
        const merged = [normalizeApifyProfile(raw[0])];
        setEdgeCache(res, 'profile-with-posts');
        return res.status(200).json(withSource(res, 'apify', { ok: true, items: merged }));
      } catch (err) {
        console.warn(`[profile-with-posts via apify] failed: ${err.message}, falling back to cluster`);
      }
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
      setEdgeCache(res, 'profile-with-posts');
      return res.status(200).json(withSource(res, 'cluster', { ok: true, items: merged }));
    }

    // posts: provider-routed. Apify uses instagram-profile-scraper which
    // bundles the latest posts WITH the profile call — so we get profile +
    // posts for the price of one actor run.
    if (action === 'posts' && resolveProvider('posts', payload.context) === 'apify') {
      const { username, limit = 12 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      try {
        run = await startRun('apify/instagram-profile-scraper', {
          usernames: [username.replace('@', '')],
          resultsLimit: Math.min(limit, 36),
        });
        completed = await pollRun(run.id);
        const raw = await getDatasetItems(completed.defaultDatasetId, 1);
        const latestPosts = raw?.[0]?.latestPosts || [];
        const normalized = latestPosts.slice(0, limit).map(normalizeApifyPost);
        setEdgeCache(res, 'posts');
        return res.status(200).json(withSource(res, 'apify', { ok: true, items: normalized }));
      } catch (err) {
        console.warn(`[posts via apify] failed: ${err.message}, falling back to cluster`);
      }
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

    // top_commenters via Apify (dashboard context): composite that uses
    // Apify profile-scraper for shortcodes + Apify comment-scraper batched.
    // Returns ranked commenters across recent posts.
    if (action === 'top_commenters' && resolveProvider('top_commenters', payload.context) === 'apify') {
      const { username, postLimit = 6, commentLimit = 50, topN = 25 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      const cleanUser = username.replace('@', '');
      try {
        // Step 1: get the user's recent post shortcodes via profile-scraper
        const profRun = await startRun('apify/instagram-profile-scraper', {
          usernames: [cleanUser],
          resultsLimit: postLimit,
        });
        const profComplete = await pollRun(profRun.id);
        const profRaw = await getDatasetItems(profComplete.defaultDatasetId, 1);
        const latestPosts = profRaw?.[0]?.latestPosts || [];
        const shortcodes = latestPosts.slice(0, postLimit).map((p) => p.shortCode || p.shortcode).filter(Boolean);
        if (shortcodes.length === 0) {
          setEdgeCache(res, 'top_commenters');
          return res.status(200).json(withSource(res, 'apify', { ok: true, items: [], postsFetched: 0 }));
        }
        // Step 2: parallel comment-scraper calls
        const commentResults = await Promise.all(shortcodes.map(async (sc) => {
          try {
            const r = await startRun('apify/instagram-comment-scraper', {
              directUrls: [`https://www.instagram.com/p/${sc}/`],
              resultsLimit: commentLimit,
            });
            const c = await pollRun(r.id);
            return await getDatasetItems(c.defaultDatasetId, commentLimit);
          } catch { return []; }
        }));
        // Step 3: aggregate
        const tally = new Map();
        for (const arr of commentResults) {
          if (!Array.isArray(arr)) continue;
          for (const c of arr) {
            const u = c.ownerUsername || c.username;
            if (!u || u === cleanUser) continue;
            const cur = tally.get(u) || {
              username: u,
              fullName: c.ownerFullName || null,
              profilePicUrl: c.ownerProfilePicUrl || null,
              isVerified: !!c.ownerIsVerified,
              commentCount: 0, totalLikes: 0, samples: [],
            };
            cur.commentCount += 1;
            cur.totalLikes += (c.likesCount ?? 0);
            const txt = c.text || '';
            if (cur.samples.length < 3 && txt) cur.samples.push(String(txt).slice(0, 240));
            tally.set(u, cur);
          }
        }
        const ranked = Array.from(tally.values())
          .sort((a, b) => b.commentCount - a.commentCount || b.totalLikes - a.totalLikes)
          .slice(0, topN);
        setEdgeCache(res, 'top_commenters');
        return res.status(200).json(withSource(res, 'apify-batch', {
          ok: true, items: ranked,
          postsFetched: shortcodes.length,
        }));
      } catch (err) {
        console.warn(`[top_commenters via apify] failed: ${err.message}, falling back to cluster`);
      }
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

    // dashboard_load via Apify: ONE profile-scraper call covers profile +
    // posts in 6s. Stories + followers stay on cluster (parallel).
    if (action === 'dashboard_load' && resolveProvider('dashboard_load', payload.context) === 'apify') {
      const { username, postLimit = 12, followerLimit = 20 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      const cleanUser = username.replace('@', '');
      // Fire Apify (profile+posts) and cluster (stories+followers) in parallel
      const apifyPromise = (async () => {
        try {
          const r = await startRun('apify/instagram-profile-scraper', {
            usernames: [cleanUser],
            resultsLimit: postLimit,
          });
          const c = await pollRun(r.id);
          const raw = await getDatasetItems(c.defaultDatasetId, 1);
          const profile = raw?.[0] ? normalizeApifyProfile(raw[0]) : null;
          const posts = (raw?.[0]?.latestPosts || []).slice(0, postLimit).map(normalizeApifyPost);
          return { profile, posts };
        } catch (err) { return { __error: err.message }; }
      })();
      const clusterPromise = callScraperBatch([
        { action: 'followers', payload: { username: cleanUser, limit: followerLimit } },
        { action: 'stories',   payload: { username: cleanUser } },
      ], 'parallel').catch(() => []);

      const [apifyResult, clusterResults] = await Promise.all([apifyPromise, clusterPromise]);
      const byAction = {
        profile:   { ok: !!apifyResult.profile, items: apifyResult.profile ? [apifyResult.profile] : [] },
        posts:     { ok: Array.isArray(apifyResult.posts), items: apifyResult.posts || [] },
        followers: clusterResults.find?.((r) => r.action === 'followers') || { ok: false, items: [] },
        stories:   clusterResults.find?.((r) => r.action === 'stories')   || { ok: false, items: [] },
      };
      setEdgeCache(res, 'dashboard_load');
      return res.status(200).json(withSource(res, 'apify-batch', { ok: true, byAction }));
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

    // comments via Apify: dashboard context. Per-comment pricing so we
    // pass through limit faithfully.
    if (action === 'comments' && resolveProvider('comments', payload.context) === 'apify') {
      const { postUrl, shortcode, limit = 50 } = payload;
      if (!postUrl && !shortcode) return res.status(400).json({ error: 'Missing postUrl or shortcode' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      const apifyUrl = postUrl || `https://www.instagram.com/p/${shortcode}/`;
      try {
        run = await startRun('apify/instagram-comment-scraper', {
          directUrls: [apifyUrl],
          resultsLimit: limit,
        });
        completed = await pollRun(run.id);
        const items = await getDatasetItems(completed.defaultDatasetId, limit);
        setEdgeCache(res, 'comments');
        return res.status(200).json(withSource(res, 'apify', { ok: true, items: items || [] }));
      } catch (err) {
        console.warn(`[comments via apify] failed: ${err.message}, falling back to cluster`);
      }
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

    // ── AD LIBRARY (Phase F) — Meta Ad Library longevity tracker ──────────
    // Given a page URL/ID, returns ads ranked by days_running. Long-running
    // ads (>7 days) AND ads with multiple creative variants are heuristics
    // for "actively scaling" — distinguishing real winners from burned cash.
    if (action === 'ad_library') {
      const { pageUrl, pageId, country = 'US', limit = 30 } = payload;
      if (!pageUrl && !pageId) return res.status(400).json({ error: 'Missing pageUrl or pageId' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
      // Build the canonical Meta Ad Library URL from pageId if not provided
      const url = pageUrl || `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&search_type=page&view_all_page_id=${pageId}`;
      try {
        run = await startRun('apify/facebook-ads-scraper', {
          startUrls: [{ url }],
          count: Math.min(Math.max(limit, 5), 100),
        });
        completed = await pollRun(run.id);
        const ads = await getDatasetItems(completed.defaultDatasetId, Math.min(limit, 100));
        const now = Date.now();
        // Compute days_running per ad + extract a clean shape for the UI
        const enriched = (ads || []).map((a) => {
          const startMs = a.startDateFormatted ? Date.parse(a.startDateFormatted) : null;
          const endMs   = a.endDateFormatted   ? Date.parse(a.endDateFormatted)   : null;
          const days_running = startMs ? Math.round((Math.min(now, endMs || now) - startMs) / 86400000) : null;
          const snap = a.snapshot || {};
          const images = Array.isArray(snap.images) ? snap.images : [];
          const videos = Array.isArray(snap.videos) ? snap.videos : [];
          const firstImg = images[0]?.original_image_url || images[0]?.resized_image_url || null;
          const firstVid = videos[0]?.video_hd_url || videos[0]?.video_sd_url || null;
          // body can be string OR { text } object
          let bodyText = null;
          if (snap.body) bodyText = (typeof snap.body === 'string') ? snap.body : (snap.body.text || null);
          else if (snap.bodyText) bodyText = snap.bodyText;
          return {
            ad_id: a.adArchiveID || a.adArchiveId,
            page_id: a.pageID || a.pageId,
            page_name: a.pageName,
            is_active: !!a.isActive,
            start_date: a.startDateFormatted,
            end_date: a.endDateFormatted,
            days_running,
            title: snap.title || snap.link_title || null,
            body_text: bodyText ? bodyText.slice(0, 600) : null,
            cta: snap.cta_text || snap.ctaText || null,
            link_url: snap.link_url || snap.linkUrl || null,
            image_url: firstImg,
            video_url: firstVid,
            categories: a.categories || [],
            reach: a.reachEstimate || null,
            currency: a.currency || null,
          };
        });
        // Sort by days_running desc (scaling indicators)
        enriched.sort((a, b) => (b.days_running || 0) - (a.days_running || 0));
        // Compute scaling-indicator summary
        const scaling = enriched.filter((e) => (e.days_running || 0) >= 7);
        // Edge cache: ad library data changes daily, cache 6h fresh + 24h SWR
        try {
          const directive = 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400';
          res.setHeader('Cache-Control', directive);
          res.setHeader('CDN-Cache-Control', directive);
          res.setHeader('Vercel-CDN-Cache-Control', directive);
        } catch {}
        return res.status(200).json(withSource(res, 'apify', {
          ok: true,
          ads: enriched,
          total: enriched.length,
          scaling_count: scaling.length,
          page_name: enriched[0]?.page_name || null,
        }));
      } catch (err) {
        console.error(`[ad_library] failed: ${err.message}`);
        return res.status(500).json({ error: err.message, _dataSource: 'error' });
      }
    }

    // ── CONTENT DECONSTRUCTION — break posts into reproducible templates ──
    // Two modes:
    //   'deconstruct'        → single post by shortcode
    //   'deconstruct_profile' → all recent posts for a username (batch)
    if (action === 'deconstruct_profile') {
      const { username, postLimit = 50 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const cleanUser = username.replace('@', '');
      try {
        // Strategy: try Apify deep scrape first. If Apify tokens exhausted
        // or APIFY_TOKEN missing, fall back to cluster profile-with-posts
        // which gives 12 latestPosts (enough for basic analysis).
        let posts = [];
        let followers = 0;
        let source = 'cluster';

        // Path A: Apify (50 posts, best analysis)
        if (APIFY_TOKEN) {
          try {
            const profRun = await startRun('apify/instagram-profile-scraper', { usernames: [cleanUser] });
            const profDone = await pollRun(profRun.id);
            const profRaw = await getDatasetItems(profDone.defaultDatasetId, 1);
            followers = profRaw?.[0]?.followersCount || 0;
            const postsRun = await startRun('apify/instagram-post-scraper', {
              username: [cleanUser], resultsLimit: Math.min(Math.max(postLimit, 10), 100),
            });
            const postsDone = await pollRun(postsRun.id);
            posts = await getDatasetItems(postsDone.defaultDatasetId, 100) || [];
            source = 'apify';
          } catch (apifyErr) {
            console.warn(`[deconstruct] Apify failed (${apifyErr.message}), falling back to cluster`);
          }
        }

        // Path B: Cluster fallback (12 posts via profile-with-posts)
        if (posts.length < 3 && SCRAPER_SERVICE_URL) {
          try {
            const tasks = [
              { action: 'profile', payload: { username: cleanUser } },
              { action: 'posts', payload: { username: cleanUser, limit: 12 } },
            ];
            const results = await callScraperBatch(tasks, 'parallel');
            const profileRes = results.find((r) => r.action === 'profile');
            const postsRes = results.find((r) => r.action === 'posts');
            if (profileRes?.ok) followers = profileRes.items?.[0]?.followers || followers;
            if (postsRes?.ok && Array.isArray(postsRes.items)) posts = postsRes.items;
            source = 'cluster-fallback';
          } catch {}
        }

        if (posts.length === 0) {
          return res.status(200).json(withSource(res, source, {
            ok: false, error: 'no-posts', reason: 'no-posts', posts_count: 0,
          }));
        }

        // Run deconstruction pipeline
        const result = contentDeconstruct.deconstructProfile(posts, {
          followers, username: cleanUser,
        });

        // Long cache — post structure changes slowly (4h fresh + 24h SWR)
        try {
          const directive = 'public, max-age=0, s-maxage=14400, stale-while-revalidate=86400';
          res.setHeader('Cache-Control', directive);
          res.setHeader('CDN-Cache-Control', directive);
          res.setHeader('Vercel-CDN-Cache-Control', directive);
        } catch {}

        return res.status(200).json(withSource(res, 'apify-deconstruct', {
          ok: true, username: cleanUser, followers, ...result,
        }));
      } catch (err) {
        console.error(`[deconstruct_profile] failed: ${err.message}`);
        return res.status(500).json({ error: err.message, _dataSource: 'error' });
      }
    }

    // ── SCRIPT STUDIO — performance calc + NLP on the user's recent posts ──
    // Fetches ~50 posts via apify/instagram-post-scraper, runs the analysis
    // pipeline (engagement score → median baseline → delta → bucket → log-odds
    // lexicon → structural blueprint → template scripts), returns everything
    // the ScriptStudioPane needs.
    if (action === 'script_studio') {
      const { username, postLimit = 50 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const cleanUser = username.replace('@', '');
      try {
        // Strategy: try Apify first (50 posts). If exhausted, fall back to
        // cluster (12 posts via profile-with-posts). 12 posts is enough for
        // Script Studio's analysis (minimum threshold is 3).
        let finalPosts = [];

        // Path A: Apify deep scrape
        if (APIFY_TOKEN) {
          try {
            run = await startRun('apify/instagram-post-scraper', {
              username: [cleanUser], resultsLimit: Math.min(Math.max(postLimit, 10), 100),
            });
            completed = await pollRun(run.id);
            finalPosts = await getDatasetItems(completed.defaultDatasetId, 100) || [];
          } catch (apifyErr) {
            console.warn(`[script_studio] Apify failed (${apifyErr.message}), trying cluster`);
          }
        }

        // Path B: Cluster fallback (profile-with-posts gives 12 latestPosts)
        if (finalPosts.length < 3 && SCRAPER_SERVICE_URL) {
          try {
            const tasks = [{ action: 'posts', payload: { username: cleanUser, limit: 12 } }];
            const results = await callScraperBatch(tasks, 'parallel');
            const postsRes = results.find((r) => r.action === 'posts');
            if (postsRes?.ok && Array.isArray(postsRes.items) && postsRes.items.length > finalPosts.length) {
              finalPosts = postsRes.items;
            }
          } catch {}
        }

        // Path C: last resort — profile-scraper latestPosts via Apify (cheaper than post-scraper)
        if (finalPosts.length < 3 && APIFY_TOKEN) {
          try {
            const profRun = await startRun('apify/instagram-profile-scraper', { usernames: [cleanUser] });
            const profDone = await pollRun(profRun.id);
            const profRaw = await getDatasetItems(profDone.defaultDatasetId, 1);
            const latestPosts = profRaw?.[0]?.latestPosts;
            if (Array.isArray(latestPosts) && latestPosts.length > finalPosts.length) {
              finalPosts = latestPosts;
            }
          } catch {}
        }
        if (!Array.isArray(finalPosts) || finalPosts.length === 0) {
          res.setHeader('x-data-source', 'apify-empty');
          return res.status(200).json(withSource(res, 'apify-empty', {
            ok: false, error: 'insufficient-posts', reason: 'no-posts', posts_count: 0,
          }));
        }
        // 2. Run the analysis pipeline (pure compute, ~15ms)
        const analysis = scriptStudio.analyze(finalPosts);

        // 2b. Phase H: optional LLM script generation (only if env key set
        // AND payload.llm=true so we don't pay for every cold call).
        if (analysis.ok && payload.llm === true && ANTHROPIC_API_KEY) {
          const aiScripts = await llmGenerateScripts({
            blueprint: analysis.blueprint,
            lexicon: analysis.lexicon,
            samples: analysis.samples,
            topic: payload.topic || null,
          });
          if (aiScripts && aiScripts.length > 0) analysis.scripts_ai = aiScripts;
        }

        // 3. Long edge cache — analyses change slowly. 4h fresh + 24h SWR.
        try {
          const directive = 'public, max-age=0, s-maxage=14400, stale-while-revalidate=86400';
          res.setHeader('Cache-Control', directive);
          res.setHeader('CDN-Cache-Control', directive);
          res.setHeader('Vercel-CDN-Cache-Control', directive);
        } catch {}
        return res.status(200).json(withSource(res, 'apify-script-studio', {
          ok: true,
          username: cleanUser,
          ...analysis,
        }));
      } catch (err) {
        console.error(`[script_studio] failed: ${err.message}`);
        return res.status(500).json({ error: err.message, _dataSource: 'error' });
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
