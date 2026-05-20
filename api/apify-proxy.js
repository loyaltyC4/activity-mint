// Vercel Serverless Function: Apify Actor Proxy + CloakBrowser Scraper Router
//
// Routes:
//   - followers, following, stories, profile → CloakBrowser scraper service (Hetzner)
//   - profile-with-posts → scraper profile + Apify profile for latestPosts
//   - comments, facebook, tiktok, linkedin, youtube → Apify actors
//
// Env vars (Vercel Settings → Environment Variables):
//   APIFY_TOKEN          — your Apify API token
//   SCRAPER_SERVICE_URL  — Hetzner URL of the CloakBrowser service (e.g. http://IP:3001)
//   SCRAPER_SECRET       — shared secret for CloakBrowser service auth

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL;
const SCRAPER_SECRET = process.env.SCRAPER_SECRET;
const BASE = 'https://api.apify.com/v2';

if (!APIFY_TOKEN) console.error('APIFY_TOKEN environment variable is not configured');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// CloakBrowser scraper service proxy (for stories, following, followers)
// ─────────────────────────────────────────────────────────────────────────────
async function callScraperService(action, payload) {
  if (!SCRAPER_SERVICE_URL) {
    throw new Error('SCRAPER_SERVICE_URL is not configured. Set it to your Hetzner scraper URL (e.g. http://IP:3001) in Vercel env vars.');
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

    // ── ROUTED TO CLOAKBROWSER SERVICE ──────────────────────────────────────
    // These actors don't work reliably on Apify, so we use our own scraper.

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
      // Try scraper service first (fast, ~7s, free)
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
          console.warn(`[profile] Scraper service failed, falling back to Apify: ${scraperErr.message}`);
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

    // ── APIFY ACTORS (working fine) ──────────────────────────────────────────
    if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });

    if (action === 'comments') {
      const { postUrl, limit = 50 } = payload;
      if (!postUrl) return res.status(400).json({ error: 'Missing postUrl' });
      run = await startRun('apify/instagram-comment-scraper', {
        directUrls: [postUrl],
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
