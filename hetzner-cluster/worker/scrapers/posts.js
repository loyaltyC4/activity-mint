/**
 * Posts scraper.
 *
 * Extracts the target's most recent N posts and their engagement metrics by
 * parsing the inline JSON Instagram embeds in the profile page. This is fast
 * (one navigation) and reliable because IG ships the data inline; DOM-only
 * scraping would need a separate page load per post.
 *
 * Returns an array of:
 *   {
 *     shortcode, url, type ('image'|'video'|'carousel'),
 *     likes, comments, videoViews,
 *     caption, hashtags, mentions,
 *     timestamp,            // ISO string
 *     mediaUrl,             // primary display URL
 *     thumbnailUrl,         // smaller preview if available
 *     isVideo, isCarousel,
 *   }
 *
 * payload.limit = how many posts to return (default 12, max 36 per call).
 */

'use strict';

const { humanDelay, isBlockedSignal } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

// Robust decode of IG's JSON unicode escapes
function decodeStr(v) {
  if (v == null) return null;
  return v
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

function extractHashtags(caption) {
  if (!caption) return [];
  const m = caption.match(/#[\p{L}\p{N}_]+/gu);
  return m ? m.map((s) => s.slice(1).toLowerCase()) : [];
}

function extractMentions(caption) {
  if (!caption) return [];
  const m = caption.match(/@[\w.]+/g);
  return m ? m.map((s) => s.slice(1).toLowerCase()) : [];
}

/**
 * Pull the edge_owner_to_timeline_media.edges array out of a profile page's
 * inline HTML and normalize each post.
 *
 * Strategy: locate the username blob first, then walk forward in the HTML to
 * find a JSON-shape edges array of media nodes. IG ships these in several
 * places (XDT_API__v1__feed__user_timeline, PolarisProfilePageContentQuery,
 * etc.), so we try a couple of likely anchors.
 */
async function extractPostsFromInlineJSON(page, targetUsername, limit) {
  const html = await page.content();
  const out = [];

  // Find a region of HTML where the media edges are likely to live. We look
  // for any "edge_owner_to_timeline_media":{"count":N,"edges":[...]} blob,
  // accepting up to ~80kb of content per blob.
  const edgesRe = /"edge_owner_to_timeline_media"\s*:\s*\{[^{}]*"edges"\s*:\s*\[([\s\S]*?)\](?:\s*,\s*"page_info"|\s*\})/g;
  let match;
  while ((match = edgesRe.exec(html)) !== null) {
    const edgesBody = match[1];
    // Split on `},{` boundaries inside the edges array. Each edge has the
    // shape {"node":{...}} so we look for "node":{ ... } substrings.
    const nodeRe = /"node"\s*:\s*\{/g;
    let m2;
    const nodeStarts = [];
    while ((m2 = nodeRe.exec(edgesBody)) !== null) {
      nodeStarts.push(m2.index + m2[0].length);
    }
    for (let i = 0; i < nodeStarts.length && out.length < limit; i++) {
      const start = nodeStarts[i];
      // Find matching closing brace by counting depth
      let depth = 1, end = start;
      while (end < edgesBody.length && depth > 0) {
        const ch = edgesBody[end];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        end++;
      }
      const nodeBlob = edgesBody.slice(start, end - 1); // exclude closing }

      const pick = (re) => {
        const x = nodeBlob.match(re);
        return x ? x[1] : null;
      };

      const shortcode = pick(/"shortcode"\s*:\s*"([^"]+)"/);
      if (!shortcode) continue;

      const isVideo = pick(/"is_video"\s*:\s*(true|false)/) === 'true';
      const productType = pick(/"product_type"\s*:\s*"([^"]+)"/);
      const isCarousel = /"__typename"\s*:\s*"GraphSidecar"/.test(nodeBlob) ||
                        /"media_type"\s*:\s*8\b/.test(nodeBlob);
      const likes = parseInt(
        pick(/"edge_(?:media_preview_like|liked_by)"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || '0',
        10,
      );
      const comments = parseInt(pick(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || '0', 10);
      const videoViews = parseInt(pick(/"video_view_count"\s*:\s*(\d+)/) || '0', 10);
      const captionRaw = pick(/"edge_media_to_caption"\s*:\s*\{\s*"edges"\s*:\s*\[\s*\{\s*"node"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const caption = captionRaw ? decodeStr(captionRaw) : null;
      const ts = pick(/"taken_at_timestamp"\s*:\s*(\d+)/);
      const timestamp = ts ? new Date(parseInt(ts, 10) * 1000).toISOString() : null;
      const displayUrl = decodeStr(pick(/"display_url"\s*:\s*"((?:[^"\\]|\\.)*)"/));
      const thumbnail = decodeStr(pick(/"thumbnail_src"\s*:\s*"((?:[^"\\]|\\.)*)"/));

      // Dedup by shortcode (multiple edges blobs may be present)
      if (out.find((p) => p.shortcode === shortcode)) continue;

      out.push({
        shortcode,
        url: `${IG_BASE}/p/${shortcode}/`,
        type: isCarousel ? 'carousel' : (isVideo ? 'video' : 'image'),
        productType: productType || null,
        likes,
        comments,
        videoViews: isVideo ? videoViews : 0,
        caption,
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
        timestamp,
        mediaUrl: displayUrl || thumbnail || null,
        thumbnailUrl: thumbnail || displayUrl || null,
        isVideo,
        isCarousel,
      });
    }
    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

async function scrapePosts(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');

  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 12, 10) || 12, 36));

  const url = `${IG_BASE}/${encodeURIComponent(username)}/`;
  log.info(`scrape posts -> ${username} (limit=${limit})`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(800, 1600);

  const status = resp ? resp.status() : 0;
  if (status === 404) throw new Error(`profile_not_found:${username}`);

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_profile');
    err.blocked = true;
    throw err;
  }

  const posts = await extractPostsFromInlineJSON(page, username, limit);
  log.info(`extracted ${posts.length} posts for ${username}`);
  return posts;
}

module.exports = { scrapePosts };
