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
    let run;

    if (action === 'followers' || action === 'following') {
      const { username, limit = 200 } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      run = await startRun(
        'scraping_solutions/instagram-scraper-followers-following-no-cookies',
        {
          Account: [username.replace('@', '')],
          scrapeType: action, // 'followers' or 'following'
        }
      );
      const completed = await pollRun(run.id);
      const items = await getDatasetItems(completed.defaultDatasetId, limit);
      return res.status(200).json({ ok: true, items });
    }

    if (action === 'profile') {
      const { username } = payload;
      if (!username) return res.status(400).json({ error: 'Missing username' });

      run = await startRun('apify/instagram-profile-scraper', {
        usernames: [username.replace('@', '')],
      });
      const completed = await pollRun(run.id);
      const items = await getDatasetItems(completed.defaultDatasetId, 1);
      return res.status(200).json({ ok: true, items });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Apify proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
