/**
 * Comments scraper (v3 - passive GraphQL interception).
 *
 * Same insight as posts.js: IG's post page is an SPA shell, comments are
 * loaded via /graphql/query POSTs whose request bodies use Meta-internal
 * session params we can't replicate. We attach a response listener BEFORE
 * navigation and harvest the bodies that look like comment-data.
 *
 * Comment data is currently shipped under one of:
 *   data.xdt_api__v1__media__N__comments__connection.edges[].node
 *   data.media.edge_media_to_parent_comment.edges[].node
 *   data.xdt_shortcode_media.edge_media_to_parent_comment.edges[].node
 *
 * payload: { shortcode | url, limit? (default 50, max 200) }
 *
 * Returns array of:
 *   { username, fullName, profilePicUrl, isVerified, text, likeCount, timestamp }
 */

'use strict';

const { humanDelay, sleep, isBlockedSignal, randInt } = require('./utils');

const IG_BASE = 'https://www.instagram.com';
const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,20}$/;

function urlFromPayload(payload) {
  if (payload?.url && typeof payload.url === 'string') {
    return payload.url.startsWith('http') ? payload.url : `${IG_BASE}${payload.url.startsWith('/') ? '' : '/'}${payload.url}`;
  }
  if (payload?.shortcode && SHORTCODE_RE.test(payload.shortcode)) {
    return `${IG_BASE}/p/${payload.shortcode}/`;
  }
  return null;
}

function normalizeNode(n) {
  if (!n) return null;
  // New shape: { text, user: {username, full_name, profile_pic_url, is_verified}, created_at, comment_like_count }
  // Old shape: { text, owner: {...}, created_at, edge_liked_by: {count} }
  const user = n.user || n.owner || {};
  const username = user.username || n.username || null;
  if (!username) return null;
  const text = typeof n.text === 'string' ? n.text : (n.text?.text || '');
  if (!text) return null;
  const ts = n.created_at ?? n.created_at_utc ?? null;
  return {
    username,
    fullName: user.full_name || null,
    profilePicUrl: user.profile_pic_url || user.profile_pic_url_hd || null,
    isVerified: !!user.is_verified,
    text,
    likeCount: n.comment_like_count ?? n.edge_liked_by?.count ?? n.like_count ?? 0,
    timestamp: ts ? new Date(ts * 1000).toISOString() : null,
  };
}

/**
 * Walk an arbitrary JSON tree looking for any array of comment-shaped
 * objects. Returns the first non-empty array found, or [].
 *
 * Comment-shape heuristic: has `text` + user/owner with username.
 */
function findCommentsInTree(node, depth = 0) {
  if (!node || depth > 12) return null;
  if (Array.isArray(node)) {
    // If this looks like an array of comment nodes / edges
    let candidate = [];
    for (const el of node) {
      const obj = el && typeof el === 'object' ? (el.node || el) : null;
      if (!obj) continue;
      const u = obj.user || obj.owner;
      if (typeof obj.text === 'string' && u && u.username) {
        candidate.push(obj);
      } else if (obj.text && typeof obj.text === 'object' && obj.text.text && u && u.username) {
        candidate.push(obj);
      }
    }
    if (candidate.length >= 1) return candidate;
    // Otherwise recurse into the array elements
    for (const el of node) {
      const r = findCommentsInTree(el, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const r = findCommentsInTree(node[k], depth + 1);
      if (r) return r;
    }
  }
  return null;
}

async function scrapeComments(page, payload, log) {
  const postUrl = urlFromPayload(payload);
  if (!postUrl) throw new Error('payload.shortcode or payload.url is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200));

  // Set up the GraphQL response capture BEFORE navigation
  const captured = [];
  const onResponse = async (resp) => {
    const url = resp.url();
    if (!/instagram\.com\/(graphql\/query|api\/graphql)/.test(url)) return;
    try {
      const txt = await resp.text();
      // Pre-filter for likely comment-bearing responses
      if (
        txt.includes('edge_media_to_parent_comment') ||
        txt.includes('xdt_api__v1__media') ||
        (txt.includes('"text":') && txt.includes('"user":') && txt.includes('"username":'))
      ) {
        captured.push(txt);
      }
    } catch (_) {}
  };
  page.on('response', onResponse);

  try {
    log.info(`scrape comments -> ${postUrl} (limit=${limit})`);
    const resp = await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = resp ? resp.status() : 0;
    if (status === 404) throw new Error(`post_not_found:${postUrl}`);

    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (isBlockedSignal(bodyText)) {
      const err = new Error('blocked_signal_on_post');
      err.blocked = true;
      throw err;
    }

    // Poll captured responses until one yields commentlike rows
    const deadline = Date.now() + 14000;
    let found = null;
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      for (const body of captured) {
        try {
          const json = JSON.parse(body);
          const arr = findCommentsInTree(json);
          if (arr && arr.length > 0) { found = arr; break; }
        } catch (_) {}
      }
      if (found) break;
    }

    if (found && found.length > 0) {
      // Some responses include a single top comment - try to expand by
      // scrolling the comments list so the SPA fires "load more" requests.
      // Then re-scan.
      if (found.length < Math.min(limit, 15)) {
        log.info(`captured ${found.length} comments; scrolling for more`);
        for (let i = 0; i < 3; i++) {
          // Find the comments section and scroll it
          await page.evaluate(() => {
            // Find any scrollable container that has many anchor children
            const lists = document.querySelectorAll('ul, [role="list"], div');
            for (const el of lists) {
              if (el.querySelectorAll('a[href^="/"]').length >= 5 && el.scrollHeight > el.clientHeight + 20) {
                el.scrollTop = el.scrollHeight;
                return;
              }
            }
            // Otherwise just scroll window
            window.scrollBy(0, 600);
          }).catch(() => {});
          await sleep(900);
          // Rescan
          for (const body of captured) {
            try {
              const json = JSON.parse(body);
              const arr = findCommentsInTree(json);
              if (arr && arr.length > found.length) { found = arr; break; }
            } catch (_) {}
          }
          if (found.length >= limit) break;
        }
      }

      const items = found.slice(0, limit).map(normalizeNode).filter(Boolean);
      log.info(`extracted ${items.length} comments for ${postUrl}`);
      return items;
    }

    log.warn(`no GraphQL comments captured for ${postUrl}`);
    return [];
  } finally {
    page.off('response', onResponse);
  }
}

module.exports = { scrapeComments };
