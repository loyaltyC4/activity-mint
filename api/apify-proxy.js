// Vercel Serverless Function: Apify Actor Proxy
// Keeps the Apify token server-side and handles polling, so the browser
// never waits on a long-running fetch and avoids any CORS issues.

// APIFY_TOKEN must be set in Vercel environment variables (Settings > Environment Variables)
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const BASE = 'https://api.apify.com/v2';

if (!APIFY_TOKEN) {
  console.error('APIFY_TOKEN environment variable is not configured');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const { data } = await res.json();
    if (data.status === 'SUCCEEDED') return data;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(data.status)) {
      throw new Error(`Actor run ${data.status}`);
    }
  }
  throw new Error('Timed out waiting for actor run');
}

async function getDatasetItems(datasetId, limit = 200) {
  const res = await fetch(
    `${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  // CORS headers so the browser can call this from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload = {} } = req.body || {};

  if (!action) return res.status(400).json({ error: 'Missing action' });
  if (!APIFY_TOKEN) return res.status(500).json({ error: 'Server misconfigured: APIFY_TOKEN not set' });

  try {
    let run, completed, items;

    // ─────────────────────────────────────────────────────────────────────────
    // INSTAGRAM: Followers
    // Actor: instaprism/instagram-followers-scraper
    // Input: { username: string, limit: number }
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'followers') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      run = await startRun('instaprism/instagram-followers-scraper', {
        username: username.replace('@', ''),
        limit: limit,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json({ ok: true, items });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSTAGRAM: Following (who the account follows)
    // Actor: instaprism/instagram-following-scraper (pay-per-event: $3.80/1000)
    // Input: { username: string, limit: number }
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'following') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      run = await startRun('instaprism/instagram-following-scraper', {
        username: username.replace('@', ''),
        limit: limit,
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json({ ok: true, items });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSTAGRAM: Profile
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'profile') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      run = await startRun('apify/instagram-profile-scraper', {
        usernames: [username.replace('@', '')],
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json({ ok: true, items });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSTAGRAM: Stories
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'stories') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      run = await startRun('gordian/instagram-story-scraper', {
        usernames: [username.replace('@', '')],
      });
      completed = await pollRun(run.id);
      items = await getDatasetItems(completed.defaultDatasetId, 100);
      return res.status(200).json({ ok: true, items });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSTAGRAM: Comments on a post
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // FACEBOOK: Posts from a page
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // TIKTOK: Profile or hashtag scraping
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // LINKEDIN: Posts from a profile or company page
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // LINKEDIN: Profile scraping (requires cookies - passed from client)
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // YOUTUBE: Transcript extraction
    // ─────────────────────────────────────────────────────────────────────────
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
    console.error('Apify proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
