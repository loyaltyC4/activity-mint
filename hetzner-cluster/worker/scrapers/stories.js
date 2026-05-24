/**
 * Stories scraper (v2 - passive GraphQL interception).
 *
 * IG's story tray is loaded via /graphql/query POSTs once the page (or the
 * story player) mounts. We attach a response listener before navigation,
 * click the profile's story ring to trigger story loading, then parse the
 * captured response bodies for reel_media items.
 *
 * Returns story items with BOTH the legacy cluster fields and the UI's
 * expected fields so consumers don't need to know which source produced
 * the row:
 *   id, type, mediaUrl, timestamp,             // cluster-style
 *   mediaType, imageUrl, videoUrl, takenAt,    // UI-style (unix seconds for takenAt)
 *   duration, viewCount,                       // extra signal when present
 *
 * payload: { username, limit? (default 50, max 200) }
 */

'use strict';

const { humanDelay, sleep, isBlockedSignal, safeWaitForSelector, randInt } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

function pickImageUrl(node) {
  const cands = node?.image_versions2?.candidates || [];
  return cands[0]?.url || null;
}
function pickVideoUrl(node) {
  const vs = node?.video_versions || [];
  return vs[0]?.url || null;
}

function normalizeStoryNode(n) {
  if (!n) return null;
  const isVideo = (n.media_type === 2) || !!(n.video_versions && n.video_versions.length);
  const imageUrl = pickImageUrl(n);
  const videoUrl = isVideo ? pickVideoUrl(n) : null;
  if (!imageUrl && !videoUrl) return null;
  const ts = n.taken_at ?? n.taken_at_timestamp ?? null;
  return {
    // cluster-style fields
    id: n.id || n.pk || null,
    type: isVideo ? 'video' : 'image',
    mediaUrl: videoUrl || imageUrl,
    timestamp: ts ? new Date(ts * 1000).toISOString() : null,
    // UI-style fields (used by apify-views.jsx StoryViewerView)
    mediaType: isVideo ? 'video' : 'image',
    imageUrl,
    videoUrl,
    takenAt: ts,
    duration: n.video_duration ?? null,
    viewCount: n.view_count ?? null,
    expiresAt: n.expiring_at ?? null,
  };
}

/**
 * Walk a parsed JSON tree, return the first array of objects that look
 * like story media nodes (have media_type or image_versions2).
 */
function findStoriesInTree(node, depth = 0) {
  if (!node || depth > 12) return null;
  if (Array.isArray(node)) {
    const candidate = [];
    for (const el of node) {
      const obj = el && typeof el === 'object' ? (el.node || el) : null;
      if (!obj) continue;
      // Story node signature: has image_versions2 OR video_versions, AND media_type
      if ((obj.image_versions2 || obj.video_versions) && (obj.media_type != null || obj.taken_at != null)) {
        candidate.push(obj);
      }
    }
    if (candidate.length >= 1) return candidate;
    for (const el of node) {
      const r = findStoriesInTree(el, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const r = findStoriesInTree(node[k], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

/** Try to find a clickable story ring link in the rendered header. */
async function findStoryEntryPoint(page, username) {
  const candidates = [
    `header a[href^="/stories/${username}/"]`,
    `a[href^="/stories/${username}/"]`,
    `[role="link"][href^="/stories/${username}/"]`,
  ];
  for (const sel of candidates) {
    const visible = await page.locator(sel).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (visible) return sel;
  }
  return null;
}

async function scrapeStories(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200));

  // Set up GraphQL response capture BEFORE navigation
  const captured = [];
  const onResponse = async (resp) => {
    const url = resp.url();
    if (!/instagram\.com\/(graphql\/query|api\/graphql|api\/v1\/feed)/.test(url)) return;
    try {
      const txt = await resp.text();
      // Pre-filter for responses that mention reel_media / story_feed / image_versions2
      if (
        txt.includes('reel_media') ||
        txt.includes('reels_media') ||
        txt.includes('xdt_api__v1__feed__reels') ||
        (txt.includes('image_versions2') && txt.includes('taken_at')) ||
        txt.includes('story_feed') ||
        txt.includes('expiring_at')
      ) {
        captured.push(txt);
      }
    } catch (_) {}
  };
  page.on('response', onResponse);

  try {
    log.info(`scrape stories -> ${username}`);
    await page.goto(`${IG_BASE}/${encodeURIComponent(username)}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await humanDelay(800, 1500);

    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (isBlockedSignal(bodyText)) {
      const err = new Error('blocked_signal_on_profile');
      err.blocked = true;
      throw err;
    }

    // Try to click the story ring so IG fires the reel_media GraphQL call.
    // If there's no active story, that's a legitimate empty result.
    const entryPoint = await findStoryEntryPoint(page, username);
    if (entryPoint) {
      log.info(`clicking story ring (${entryPoint})`);
      await page.locator(entryPoint).first().click({ timeout: 5000 }).catch((err) => {
        log.warn(`story click failed: ${err.message}`);
      });
      // Wait for the story player to mount + load the reel_media data
      await sleep(2500 + randInt(0, 500));
    } else {
      log.info(`no story ring visible for ${username}; checking captured responses anyway`);
    }

    // Poll captured responses (the page may continue firing fetches after the click)
    const deadline = Date.now() + 8000;
    let found = null;
    while (Date.now() < deadline) {
      for (const body of captured) {
        try {
          const json = JSON.parse(body);
          const arr = findStoriesInTree(json);
          if (arr && arr.length > 0) { found = arr; break; }
        } catch (_) {}
      }
      if (found) break;
      await sleep(400);
    }

    if (found && found.length > 0) {
      const items = found.slice(0, limit).map(normalizeStoryNode).filter(Boolean);
      log.info(`extracted ${items.length} stories for ${username}`);
      return items;
    }

    log.info(`no stories for ${username} (no captured reel_media, no entry point)`);
    return [];
  } finally {
    page.off('response', onResponse);
  }
}

module.exports = { scrapeStories };
