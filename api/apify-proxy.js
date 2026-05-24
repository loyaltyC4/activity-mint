// Vercel Serverless Function: Apify Actor Proxy + CloakBrowser Scraper Router
//
// Routes:
//   - followers, following, stories, profile → CloakBrowser scraper cluster (Hetzner orchestrator)
//   - profile-with-posts → scraper profile + Apify profile for latestPosts
//   - comments, facebook, tiktok, linkedin, youtube → Apify actors
//
// The Hetzner orchestrator on :3001 is responsible for picking which of the 5
// workers handles each scrape (sticky-by-username with least-loaded fallback).
// Each worker is pre-paired with its own Instagram account + dedicated SOCKS5
// proxy + persistent CloakBrowser profile — this function does NOT pick proxies
// or profiles anymore; the orchestrator owns that decision.
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
// CloakBrowser scraper service proxy (for stories, following, followers, profile)
// ─────────────────────────────────────────────────────────────────────────────
async function callScraperService(action, payload) {
  if (!SCRAPER_SERVICE_URL) {
    throw new Error('SCRAPER_SERVICE_URL is not configured. Set it to your Hetzner orchestrator URL (e.g. http://IP:3001) in Vercel env vars.');
  }

  const res = await fetch(`${SCRAPER_SERVICE_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {}),
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || !body.ok) throw new Error(body.error || `Scraper service error (${res.status})`);
  return body.items;
}

// ─── Cluster batch call ─────────────────────────────────────────────────
// Fans tasks across multiple workers via /scrape/batch. Per-task failures
// don't fail the whole call - each result carries its own ok flag so we
// can stitch partial UI even if one worker is down.
async function callScraperBatch(tasks, strategy = 'parallel') {
  if (!SCRAPER_SERVICE_URL) throw new Error('SCRAPER_SERVICE_URL is not configured');
  const res = await fetch(`${SCRAPER_SERVICE_URL}/scrape/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {}),
    },
    body: JSON.stringify({ tasks, strategy }),
  });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(body.error || `Scraper batch error (${res.status})`);
  if (!body.results) throw new Error('Scraper batch returned no results');
  return body.results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apify helpers
// ─────────────────────────────────────────────────────────────────────────────
async function startRun(actorId, input) {
  const res = await fetch(
    `${BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to start actor (${res.status}): ${text}`);
  }
  const { data } = await res.json();
  return data;
}

async function pollRun(runId, maxWaitMs = 110000, intervalMs = 4000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const res = await fetch(`${BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to poll run status (${res.status}): ${text}`);
    }
    const { data } = await res.json();
    if (!data) throw new Error('Empty response while polling run status');
    if (data.status === 'SUCCEEDED') return data;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(data.status)) {
      throw new Error(`Actor run ${data.status}${data.statusMessage ? `: ${data.statusMessage}` : ''}`);
    }
  }
  throw new Error('Timed out waiting for actor run — try a smaller limit.');
}

async function getDatasetItems(datasetId, limit = 200) {
  const res = await fetch(
    `${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  const items = await res.json();
  // Detect instaprism free-tier-limit response
  if (Array.isArray(items) && items.length === 1 && items[0]?.status === 'free_tier_limit_reached') {
    throw new Error('Apify free tier limit reached. The Instagram scraper service handles this — ensure SCRAPER_SERVICE_URL is configured.');
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload = {} } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Missing action' });

  try {
    let run, completed, items;

    // ── ROUTED TO CLOAKBROWSER CLUSTER ──────────────────────────────────────
    // These actors don't work reliably on Apify, so we use our own 5-worker cluster.

    if (action === 'followers') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      items = await callScraperService('followers', { username, limit });
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'following') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      items = await callScraperService('following', { username, limit });
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'stories') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      items = await callScraperService('stories', { username });
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'profile') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      // Try scraper cluster first (fast, ~7s, free)
      if (SCRAPER_SERVICE_URL) {
        try {
          const scraperItems = await callScraperService('profile', { username });
          if (scraperItems && scraperItems.length > 0) {
            // Normalize field names to match what the frontend expects
            const p = scraperItems[0];
            items = [{
              ...p,
              profilePicUrlHD: p.profilePicUrl,
              followsCount: p.followingCount,
              verified: p.isVerified,
              private: p.isPrivate,
            }];
            return res.status(200).json({ ok: true, items });
          }
        } catch (scraperErr) {
          console.warn(`[profile] Scraper cluster failed, falling back to Apify: ${scraperErr.message}`);
        }
      }
      // Fallback to Apify (slower ~60s, includes latestPosts)
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'Both scraper and Apify unavailable' });
      run = await startRun('apify/instagram-profile-scraper', {
        usernames: [username.replace('@', '')],
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json({ ok: true, items });
    }

    // profile-with-posts: Used by PostViewerView which needs latestPosts (Apify only)
    if (action === 'profile-with-posts') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });
      run = await startRun('apify/instagram-profile-scraper', {
        usernames: [username.replace('@', '')],
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json({ ok: true, items });
    }

    // ── CLUSTER-NATIVE actions (no Apify fallback) ──────────────────────────

    // posts: recent posts with engagement metrics, extracted from the profile
    // page's inline JSON. Single cluster call (one worker, one navigation).
    if (action === 'posts') {
      const { username, limit = 12 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      items = await callScraperService('posts', { username: username.replace('@', ''), limit });
      return res.status(200).json({ ok: true, items });
    }

    // audience_enrichment: sample N followers + enrich each with bio + city
    // signal + hashtags. Used by Audience Interest, Geographic Spread,
    // and Outreach panels.
    if (action === 'audience_enrichment') {
      const { username, sample = 20, offset = 0 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      items = await callScraperService('audience_enrichment', {
        username: username.replace('@', ''), sample, offset,
      });
      return res.status(200).json({ ok: true, items });
    }

    // top_commenters: composite action.
    //   1. cluster: posts(username, limit=postLimit) on one worker
    //   2. cluster: batch comments(shortcode, limit=commentLimit) across workers
    //   3. for any post that came back empty from the cluster, fan out an
    //      Apify comments-actor call in parallel (Apify gives reliable data
    //      where cluster GraphQL interception sometimes misses comments)
    //   4. aggregate commenters across all posts, sort, return top N
    if (action === 'top_commenters') {
      const { username, postLimit = 6, commentLimit = 50, topN = 25 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });
      const cleanUser = username.replace('@', '');
      const posts = await callScraperService('posts', { username: cleanUser, limit: postLimit });
      if (!posts || posts.length === 0) return res.status(200).json({ ok: true, items: [] });

      // Cluster pass via batch
      const tasks = posts.map((p) => ({
        action: 'comments',
        payload: { shortcode: p.shortcode, limit: commentLimit },
      }));
      const clusterResults = await callScraperBatch(tasks, 'parallel');

      // Per-post Apify fallback for posts the cluster missed - in parallel
      const needsFallback = [];
      for (let i = 0; i < posts.length; i++) {
        const r = clusterResults[i];
        if (!r || !r.ok || !Array.isArray(r.items) || r.items.length === 0) {
          needsFallback.push({ idx: i, post: posts[i] });
        }
      }
      if (needsFallback.length > 0 && APIFY_TOKEN) {
        const apifyResults = await Promise.all(needsFallback.map(async (nf) => {
          try {
            const url = `https://www.instagram.com/p/${nf.post.shortcode}/`;
            const r = await startRun('apify/instagram-comment-scraper', {
              directUrls: [url], resultsLimit: commentLimit,
            });
            const completed = await pollRun(r.id);
            const itx = await getDatasetItems(completed.defaultDatasetId, commentLimit);
            return { idx: nf.idx, items: itx };
          } catch (err) {
            console.warn(`[top_commenters] Apify fallback for ${nf.post.shortcode} failed: ${err.message}`);
            return { idx: nf.idx, items: [] };
          }
        }));
        for (const ar of apifyResults) {
          clusterResults[ar.idx] = { ok: true, items: ar.items };
        }
      }

      // Aggregate commenters across all posts. Normalize Apify shape
      // (ownerUsername, ownerProfilePicUrl, likesCount) into cluster shape
      // (username, profilePicUrl, likeCount).
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
      return res.status(200).json({
        ok: true,
        items: ranked,
        postsFetched: posts.length,
        fallbackUsed: needsFallback.length,
      });
    }

    // dashboard_load: ONE call from the dashboard fetches profile + posts +
    // followers (sample) + stories in parallel by fanning across workers.
    // Replaces a sequential chain that took 30-60s with a parallel batch
    // that completes in 10-15s on a healthy 3-worker cluster.
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
      return res.status(200).json({ ok: true, byAction });
    }

    // ── APIFY ACTORS (working fine) ──────────────────────────────────────────
    if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });

    // comments: now tries the cluster first (fast, free), falls back to Apify
    // if the cluster fails. Old shape { postUrl, limit } still works; new
    // shape { shortcode, limit } also accepted.
    if (action === 'comments') {
      const { postUrl, shortcode, limit = 50 } = payload;
      if (!postUrl && !shortcode) return res.status(400).json({ error: 'Missing postUrl or shortcode' });

      // Try cluster first
      if (SCRAPER_SERVICE_URL) {
        try {
          const clusterPayload = shortcode ? { shortcode, limit } : { url: postUrl, limit };
          items = await callScraperService('comments', clusterPayload);
          if (items && items.length > 0) return res.status(200).json({ ok: true, items });
        } catch (err) {
          console.warn(`[comments] Cluster failed, falling back to Apify: ${err.message}`);
        }
      }

      // Apify fallback
      const apifyUrl = postUrl || `https://www.instagram.com/p/${shortcode}/`;
      run = await startRun('apify/instagram-comment-scraper', {
        directUrls: [apifyUrl],
        resultsLimit: limit,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json({ ok: true, items });
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
      return res.status(200).json({ ok: true, items });
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
      return res.status(200).json({ ok: true, items });
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
      return res.status(200).json({ ok: true, items });
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
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'youtube-transcript') {
      const { videoUrl } = payload;
      if (!videoUrl) return res.status(400).json({ error: 'Missing videoUrl' });
      run = await startRun('pintostudio/youtube-transcript-scraper', {
        videoUrl: videoUrl,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json({ ok: true, items });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
