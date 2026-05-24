/**
 * Posts scraper (v3 - passive GraphQL interception).
 *
 * IG's profile page is an SPA shell. The post grid is loaded via a POST to
 * /graphql/query that responds with the path:
 *   data.xdt_api__v1__feed__user_timeline_graphql_connection.edges[].node
 *
 * Replicating that POST from outside is impractical - the body uses
 * Meta-internal session params (__csr, __dyn, __hsi, etc.) that aren't
 * stable. Instead we let the SPA fire the request itself and PASSIVELY
 * intercept the response body via page.on('response'). We only need to
 * read the bytes; we don't need to craft the request.
 *
 * 2026 field renames (vs. pre-SPA shape):
 *   - shortcode             -> code
 *   - taken_at_timestamp    -> taken_at
 *   - edge_media_to_caption -> caption (object with .text)
 *   - edge_liked_by.count   -> like_count
 *   - edge_media_to_comment -> comment_count
 *   - media_type            -> 1=image, 2=video, 8=carousel
 *
 * Returns array of post records, same shape as before so callers don't care.
 *
 * payload: { username, limit? (default 12, max 36) }
 */

'use strict';

const { humanDelay, isBlockedSignal } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

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
 * Phase 6 HD media: pick the largest image_versions2 candidate (sorted by
 * width*height). The candidates array isn't guaranteed sorted — sometimes
 * the first entry is a 320px thumb. We pick the biggest sane variant and
 * the smallest one separately for thumbnail.
 */
function pickImageUrl(n) {
  const cands = n?.image_versions2?.candidates || [];
  if (cands.length === 0) return null;
  const sorted = [...cands]
    .filter((c) => c && c.url)
    .map((c) => ({ ...c, _px: (c.width || 0) * (c.height || 0) }))
    .filter((c) => c._px === 0 || (c.width <= 2160 && c.height <= 2160))
    .sort((a, b) => b._px - a._px);
  return sorted[0]?.url || cands[0]?.url || null;
}
function pickThumbnailUrl(n) {
  const cands = n?.image_versions2?.candidates || [];
  if (cands.length === 0) return null;
  const sorted = [...cands]
    .filter((c) => c && c.url)
    .map((c) => ({ ...c, _px: (c.width || 0) * (c.height || 0) }))
    .sort((a, b) => a._px - b._px);
  return sorted[0]?.url || cands[cands.length - 1]?.url || null;
}
function pickVideoUrl(n) {
  const vs = n?.video_versions || [];
  if (vs.length === 0) return null;
  const sorted = [...vs]
    .filter((v) => v && v.url)
    .sort((a, b) => (b.width || 0) - (a.width || 0) || (a.type || 999) - (b.type || 999));
  return sorted[0]?.url || vs[0]?.url || null;
}

function normalizeNode(n) {
  if (!n) return null;
  const code = n.code || n.shortcode || null;
  const caption = n?.caption?.text || n?.edge_media_to_caption?.edges?.[0]?.node?.text || null;
  const mt = n.media_type;
  const isCarousel = mt === 8 || n.__typename === 'GraphSidecar';
  const isVideo = mt === 2 || !!(n.video_versions && n.video_versions.length);
  const ts = n.taken_at ?? n.taken_at_timestamp ?? null;

  // Phase 6: expand carousel children with their own HD media.
  // carousel_media is the new path; edge_sidecar_to_children was the
  // pre-SPA shape.
  let carouselItems = null;
  if (isCarousel) {
    const children = n.carousel_media || n.edge_sidecar_to_children?.edges?.map((e) => e.node) || [];
    if (children.length > 0) {
      carouselItems = children.map((c) => {
        const cIsVideo = c.media_type === 2 || !!(c.video_versions && c.video_versions.length);
        return {
          mediaType: cIsVideo ? 'video' : 'image',
          imageUrl: pickImageUrl(c),
          videoUrl: cIsVideo ? pickVideoUrl(c) : null,
          videoDashManifest: c.video_dash_manifest || null,
          duration: c.video_duration ?? null,
        };
      });
    }
  }

  return {
    shortcode: code,
    url: code ? `${IG_BASE}/p/${code}/` : null,
    type: isCarousel ? 'carousel' : (isVideo ? 'video' : 'image'),
    productType: n.product_type || null,
    likes: n.like_count ?? n.edge_media_preview_like?.count ?? n.edge_liked_by?.count ?? 0,
    comments: n.comment_count ?? n.edge_media_to_comment?.count ?? 0,
    videoViews: isVideo ? (n.play_count ?? n.view_count ?? n.video_view_count ?? 0) : 0,
    caption,
    hashtags: extractHashtags(caption),
    mentions: extractMentions(caption),
    timestamp: ts ? new Date(ts * 1000).toISOString() : null,
    mediaUrl: pickImageUrl(n) || pickVideoUrl(n) || n.display_url || null,
    thumbnailUrl: pickThumbnailUrl(n) || n.thumbnail_src || null,
    // Phase 6: HD-specific fields. Frontends that want full quality use these.
    imageUrlHD: pickImageUrl(n),
    videoUrlHD: pickVideoUrl(n),
    videoDashManifest: n.video_dash_manifest || null,
    isVideo,
    isCarousel,
    carouselItems,
  };
}

/**
 * Try parsing every captured GraphQL response. Returns the first edges
 * array found at the known xdt_api path, or [] if nothing matched.
 */
function findEdgesInCaptured(captured) {
  for (const body of captured) {
    try {
      const json = JSON.parse(body);
      const conn = json?.data?.xdt_api__v1__feed__user_timeline_graphql_connection
                || json?.data?.user?.edge_owner_to_timeline_media
                || json?.data?.xdt_api__v1__feed__reels_media__connection;
      const edges = conn?.edges;
      if (Array.isArray(edges) && edges.length > 0) return edges;
    } catch (_) {}
  }
  return [];
}

async function scrapePosts(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 12, 10) || 12, 36));

  // Set up the response interceptor BEFORE navigation so we don't miss
  // early SPA calls. We collect every GraphQL response body that mentions
  // a known posts data key.
  const captured = [];
  const onResponse = async (resp) => {
    const url = resp.url();
    if (!/instagram\.com\/(graphql\/query|api\/graphql)/.test(url)) return;
    try {
      const txt = await resp.text();
      // Cheap pre-filter so we don't keep big unrelated bodies in memory
      if (
        txt.includes('xdt_api__v1__feed__user_timeline') ||
        txt.includes('edge_owner_to_timeline_media') ||
        txt.includes('"code":"') && txt.includes('"caption"')
      ) {
        captured.push(txt);
      }
    } catch (_) {}
  };
  page.on('response', onResponse);

  try {
    const url = `${IG_BASE}/${encodeURIComponent(username)}/`;
    log.info(`scrape posts -> ${username} (limit=${limit})`);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = resp ? resp.status() : 0;
    if (status === 404) throw new Error(`profile_not_found:${username}`);

    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (isBlockedSignal(bodyText)) {
      const err = new Error('blocked_signal_on_profile');
      err.blocked = true;
      throw err;
    }

    // Wait for the SPA to fire its post-loading GraphQL calls. We poll the
    // captured array; if we get a posts response early, return quickly.
    const deadline = Date.now() + 14000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      if (findEdgesInCaptured(captured).length > 0) break;
    }

    const edges = findEdgesInCaptured(captured);
    if (edges.length > 0) {
      const posts = edges.slice(0, limit).map((e) => normalizeNode(e.node)).filter(Boolean);
      log.info(`captured ${edges.length} edges; returning ${posts.length} posts for ${username}`);
      return posts;
    }

    // Fallback: DOM scrape /p/ anchors that the SPA may have rendered
    log.warn(`no GraphQL posts captured for ${username}, trying DOM scrape`);
    try { await page.waitForSelector('a[href^="/p/"], a[href^="/reel/"]', { timeout: 6000 }); } catch (_) {}
    const domPosts = await page.evaluate((max) => {
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
        const img = a.querySelector('img');
        const thumb = img ? (img.getAttribute('src') || null) : null;
        const isReel = href.startsWith('/reel/');
        out.push({
          shortcode: sc,
          url: 'https://www.instagram.com' + href,
          type: isReel ? 'video' : 'image',
          likes: 0,
          comments: 0,
          videoViews: 0,
          caption: null, hashtags: [], mentions: [],
          timestamp: null,
          mediaUrl: thumb, thumbnailUrl: thumb,
          isVideo: isReel, isCarousel: false,
          _engagementMissing: true,
        });
      }
      return out;
    }, limit).catch(() => []);
    log.info(`DOM scrape returned ${domPosts.length} posts for ${username}`);
    return domPosts;
  } finally {
    page.off('response', onResponse);
  }
}

module.exports = { scrapePosts };
