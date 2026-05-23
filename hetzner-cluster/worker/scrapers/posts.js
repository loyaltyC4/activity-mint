/**
 * Posts scraper (v2 - API-based).
 *
 * Instagram's profile page is a SPA shell as of 2026 - the post grid is
 * loaded via a separate API call after JS executes, so the rendered HTML
 * contains NO inline JSON anchors (no edge_owner_to_timeline_media, no
 * shortcode strings, nothing).
 *
 * Strategy: from inside the logged-in page context (cookies + ig app id),
 * call IG's own /api/v1/users/web_profile_info/?username=X endpoint - it
 * returns the user's web profile bundle including the first 12 posts under
 * data.user.edge_owner_to_timeline_media.edges. This is the same call the
 * SPA itself makes, so the auth shape works as long as the worker session
 * is valid.
 *
 * If that fails (logged-out shell, IG response changed), fall back to a
 * DOM-scrape of the post grid - we get shortcodes but not engagement, and
 * the caller can fan out per-post fetches for engagement via the batch
 * endpoint.
 *
 * Returns: array of post records (see field list at bottom).
 *
 * payload: { username, limit? (default 12, max 36) }
 */

'use strict';

const { humanDelay, isBlockedSignal } = require('./utils');

const IG_BASE = 'https://www.instagram.com';
const IG_APP_ID = '936619743392459';  // public web IG app id

function extractHashtags(caption) {
  if (!caption) return [];
  const m = caption.match(/#[\p{L}\p{N}_]+/gu);
  return m ? [...new Set(m.map((s) => s.slice(1).toLowerCase()))] : [];
}
function extractMentions(caption) {
  if (!caption) return [];
  const m = caption.match(/@[\w.]+/g);
  return m ? [...new Set(m.map((s) => s.slice(1).toLowerCase()))] : [];
}

/**
 * Normalize one IG GraphQL edge node into our post shape.
 */
function normalizeNode(n) {
  const caption = n?.edge_media_to_caption?.edges?.[0]?.node?.text || null;
  const isCarousel = n?.__typename === 'GraphSidecar';
  const isVideo = !!n?.is_video;
  const ts = n?.taken_at_timestamp;
  return {
    shortcode: n?.shortcode || null,
    url: n?.shortcode ? `${IG_BASE}/p/${n.shortcode}/` : null,
    type: isCarousel ? 'carousel' : (isVideo ? 'video' : 'image'),
    productType: n?.product_type || null,
    likes: n?.edge_media_preview_like?.count ?? n?.edge_liked_by?.count ?? 0,
    comments: n?.edge_media_to_comment?.count ?? 0,
    videoViews: isVideo ? (n?.video_view_count ?? 0) : 0,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    timestamp: ts ? new Date(ts * 1000).toISOString() : null,
    mediaUrl: n?.display_url || n?.thumbnail_src || null,
    thumbnailUrl: n?.thumbnail_src || n?.display_url || null,
    isVideo,
    isCarousel,
  };
}

/**
 * Call web_profile_info from inside the logged-in page context.
 * Returns { user } or null.
 */
async function fetchWebProfileInfoFromPage(page, username) {
  const apiUrl = `${IG_BASE}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  return page.evaluate(async (args) => {
    try {
      const r = await fetch(args.url, {
        headers: {
          'x-ig-app-id': args.appId,
          'accept': 'application/json',
          'sec-fetch-site': 'same-origin',
        },
        credentials: 'include',
      });
      if (!r.ok) return { __err: `http_${r.status}` };
      const j = await r.json();
      return j?.data || j;
    } catch (e) {
      return { __err: e.message || 'fetch_failed' };
    }
  }, { url: apiUrl, appId: IG_APP_ID }).catch(() => null);
}

/**
 * DOM fallback - walk the post grid for shortcode anchors. No engagement,
 * caller can fan per-post fetches via batch for that.
 */
async function scrapePostsFromDom(page, limit) {
  return page.evaluate((max) => {
    const links = Array.from(document.querySelectorAll('a[href^="/p/"], a[href^="/reel/"]'));
    const seen = new Set();
    const out = [];
    for (const a of links) {
      if (out.length >= max) break;
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      if (!m) continue;
      const sc = m[1];
      if (seen.has(sc)) continue;
      seen.add(sc);
      // Grab thumbnail if present
      const img = a.querySelector('img');
      const thumb = img ? (img.getAttribute('src') || null) : null;
      const isReel = href.startsWith('/reel/');
      out.push({
        shortcode: sc,
        url: `https://www.instagram.com${href}`,
        type: isReel ? 'video' : 'image',
        likes: 0,
        comments: 0,
        videoViews: 0,
        caption: null,
        hashtags: [],
        mentions: [],
        timestamp: null,
        mediaUrl: thumb,
        thumbnailUrl: thumb,
        isVideo: isReel,
        isCarousel: false,
        _engagementMissing: true,
      });
    }
    return out;
  }, limit).catch(() => []);
}

async function scrapePosts(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 12, 10) || 12, 36));

  // We need to be on instagram.com so the API call inherits the right
  // origin + cookies. Going to the profile page also lets the SPA chunks
  // warm up if we need to fall back to DOM scraping.
  const url = `${IG_BASE}/${encodeURIComponent(username)}/`;
  log.info(`scrape posts -> ${username} (limit=${limit})`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(600, 1100);

  const status = resp ? resp.status() : 0;
  if (status === 404) throw new Error(`profile_not_found:${username}`);

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_profile');
    err.blocked = true;
    throw err;
  }

  // Strategy 1: API call from inside the page
  log.info(`fetching web_profile_info for ${username}`);
  const data = await fetchWebProfileInfoFromPage(page, username);

  if (data && data.user && !data.__err) {
    const edges = data.user.edge_owner_to_timeline_media?.edges || [];
    if (edges.length > 0) {
      const posts = edges.slice(0, limit).map((e) => normalizeNode(e.node));
      log.info(`extracted ${posts.length} posts via API for ${username}`);
      return posts;
    }
    log.warn(`web_profile_info returned no edges for ${username} (private or empty profile)`);
    // Surface up - private accounts legitimately have no public posts
    if (data.user?.is_private) return [];
  } else {
    log.warn(`web_profile_info failed for ${username}: ${data?.__err || 'no_data'}`);
  }

  // Strategy 2: wait for the post grid to render, then DOM scrape
  log.info(`falling back to DOM scrape for ${username} posts`);
  // Wait up to 8s for at least one /p/ anchor to appear
  try {
    await page.waitForSelector('a[href^="/p/"], a[href^="/reel/"]', { timeout: 8000 });
  } catch (_) {}
  const domPosts = await scrapePostsFromDom(page, limit);
  log.info(`DOM scrape returned ${domPosts.length} posts for ${username}`);
  return domPosts;
}

module.exports = { scrapePosts };
