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
 * Walk a parsed JSON tree, return the first array of STORY-specific media
 * nodes. A node is a story only if it has an `expiring_at` timestamp OR a
 * `story_type` field — those are exclusive to story media. Posts have
 * `image_versions2 + taken_at` too but never `expiring_at` (posts don't
 * expire). This is the guard that prevents the "story viewer shows posts"
 * regression.
 */
function isStoryNode(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!(obj.image_versions2 || obj.video_versions)) return false;
  // Strong story-only signals — at least ONE must be present:
  //   expiring_at        : stories expire 24h after upload, posts never expire
  //   story_type         : reels v1/v2 surface
  //   is_reel_media      : explicit boolean
  //   reel_mentions      : story-only tagging
  // We also accept media_type=2 (video) within a context that already had
  // a story marker — that's enforced by the caller's pre-filter.
  if (obj.expiring_at) return true;
  if (obj.story_type != null) return true;
  if (obj.is_reel_media === true) return true;
  if (Array.isArray(obj.reel_mentions) && obj.reel_mentions.length > 0) return true;
  if (Array.isArray(obj.story_locations) && obj.story_locations.length > 0) return true;
  // Explicit anti-pattern: posts carry shortcode/code, stories don't.
  if (obj.shortcode || obj.code) return false;
  return false;
}

function findStoriesInTree(node, depth = 0) {
  if (!node || depth > 12) return null;
  if (Array.isArray(node)) {
    const candidate = [];
    for (const el of node) {
      const obj = el && typeof el === 'object' ? (el.node || el) : null;
      if (isStoryNode(obj)) candidate.push(obj);
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

/**
 * Try the canonical IG API for stories first: feed/reels_media by user PK.
 * Needs the user's numeric ID, which web_profile_info returns. Returns null
 * if anything fails so the caller falls back to the navigation path.
 */
async function fetchReelsMediaApi(page, username, log) {
  try {
    // Step 1: get the user ID via web_profile_info
    const userInfo = await page.evaluate(async (u) => {
      const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(u)}`, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459', 'accept': '*/*' },
      });
      if (!r.ok) return { __error: `HTTP ${r.status}` };
      return await r.json();
    }, username);
    const userId = userInfo?.data?.user?.id;
    if (!userId) {
      log.info(`reels_media: no user id for ${username}`);
      return null;
    }

    // Step 2: hit /api/v1/feed/reels_media/?reel_ids=ID
    const reelsResp = await page.evaluate(async (id) => {
      const r = await fetch(`https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${id}`, {
        credentials: 'include',
        headers: { 'x-ig-app-id': '936619743392459', 'accept': '*/*' },
      });
      if (!r.ok) return { __error: `HTTP ${r.status}` };
      return await r.json();
    }, userId);
    if (!reelsResp || reelsResp.__error) {
      log.info(`reels_media: ${reelsResp?.__error || 'empty'}`);
      return null;
    }

    const reels = reelsResp?.reels || reelsResp?.reels_media || {};
    const reel = reels[userId] || (Array.isArray(reelsResp.reels_media) ? reelsResp.reels_media[0] : null);
    const items = reel?.items;
    if (!Array.isArray(items)) {
      log.info(`reels_media: no items array for ${username}`);
      return [];
    }
    return items;
  } catch (err) {
    log.warn(`reels_media exception: ${err.message}`);
    return null;
  }
}

async function scrapeStories(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200));

  // Set up GraphQL response capture BEFORE navigation. Pre-filter requires
  // an explicit STORY marker — the previous "image_versions2 + taken_at"
  // fallback also matched POST GraphQL responses, which caused the story
  // viewer to display posts when the user had no active stories.
  const captured = [];
  const onResponse = async (resp) => {
    const url = resp.url();
    if (!/instagram\.com\/(graphql\/query|api\/graphql|api\/v1\/feed)/.test(url)) return;
    try {
      const txt = await resp.text();
      if (
        txt.includes('reel_media') ||
        txt.includes('reels_media') ||
        txt.includes('xdt_api__v1__feed__reels') ||
        txt.includes('expiring_at') ||
        txt.includes('story_feed_tray')
      ) {
        captured.push(txt);
      }
    } catch (_) {}
  };
  page.on('response', onResponse);

  try {
    log.info(`scrape stories -> ${username}`);
    // Navigate to the user's profile first so we have a valid IG context
    // for subsequent fetch() calls (cookies + same-origin).
    await page.goto(`${IG_BASE}/${encodeURIComponent(username)}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await humanDelay(400, 800);

    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (isBlockedSignal(bodyText)) {
      const err = new Error('blocked_signal_on_profile');
      err.blocked = true;
      throw err;
    }

    // PRIMARY: hit the reels_media API directly. This is the same endpoint
    // IG's web app uses when you click a story ring — but we skip the click
    // and fetch it ourselves, riding the session cookies.
    const apiItems = await fetchReelsMediaApi(page, username, log);
    if (Array.isArray(apiItems) && apiItems.length > 0) {
      const items = apiItems.slice(0, limit).map(normalizeStoryNode).filter(Boolean);
      log.info(`reels_media API extracted ${items.length} stories for ${username}`);
      return items;
    }
    if (Array.isArray(apiItems) && apiItems.length === 0) {
      log.info(`reels_media API returned empty (no active stories) for ${username}`);
      return [];
    }

    // FALLBACK: navigate to /stories/USERNAME/ and harvest reel_media from
    // captured GraphQL responses. If no stories exist, IG redirects back
    // to the profile and no GraphQL fires.
    log.info(`reels_media API unavailable; trying navigation fallback`);
    const storiesUrl = `${IG_BASE}/stories/${encodeURIComponent(username)}/`;
    await page.goto(storiesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await sleep(2500 + randInt(0, 500));

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
      log.info(`navigation fallback extracted ${items.length} stories for ${username}`);
      return items;
    }

    log.info(`no stories for ${username}`);
    return [];
  } finally {
    page.off('response', onResponse);
  }
}

module.exports = { scrapeStories };
