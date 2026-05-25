/**
 * Comments scraper (v4 - direct API + click-to-expand + GraphQL interception).
 *
 * Three attack vectors, tried in order:
 *
 *   1. DIRECT API: /api/v1/media/{media_id}/comments/ — same endpoint the
 *      SPA calls, but we fetch it ourselves via page.evaluate(). Needs the
 *      media_id which we extract from the page's inline JSON.
 *      Fastest path (~1-2s if session cookies are valid).
 *
 *   2. CLICK-TO-EXPAND: IG lazy-loads comments behind a "View all X comments"
 *      link. We click it, scroll down, and wait for the GraphQL response.
 *      This is what the v3 scraper was MISSING — it waited for GraphQL
 *      without ever triggering the comments load.
 *
 *   3. PASSIVE GRAPHQL INTERCEPTION: same as v3 — capture any GraphQL
 *      response that looks like comments data. Still useful as a fallback
 *      if the direct API fails or returns partial results.
 *
 * payload: { shortcode | url, limit? (default 50, max 200) }
 * Returns array of: { username, fullName, profilePicUrl, isVerified, text, likeCount, timestamp }
 */

'use strict';

const { humanDelay, sleep, isBlockedSignal, randInt, ensureIGContext } = require('./utils');

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

function findCommentsInTree(node, depth = 0) {
  if (!node || depth > 12) return null;
  if (Array.isArray(node)) {
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

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR 1: Direct API call for comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the media_id from the post page's inline JSON. IG embeds it in
 * meta tags and script blocks.
 */
async function getMediaId(page, log) {
  try {
    return await page.evaluate(() => {
      // Method 1: al:ios:url meta tag contains media?id=NNNNN
      const meta = document.querySelector('meta[property="al:ios:url"]');
      if (meta) {
        const m = meta.content.match(/media\?id=(\d+)/);
        if (m) return m[1];
      }
      // Method 2: og:url sometimes has the numeric form
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) {
        const m2 = ogUrl.content.match(/\/p\/([A-Za-z0-9_-]+)/);
        // Can't convert shortcode to media_id client-side without the algorithm
      }
      // Method 3: search all script tags for "media_id":"NNNN"
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const txt = s.textContent || '';
        // Pattern: "pk":"12345" or "media_id":"12345" or "id":"12345"
        const m3 = txt.match(/"(?:pk|media_id)"\s*:\s*"?(\d{10,})"?/);
        if (m3) return m3[1];
      }
      // Method 4: structured data
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of ldScripts) {
        try {
          const d = JSON.parse(s.textContent);
          if (d.identifier) return String(d.identifier);
        } catch {}
      }
      return null;
    });
  } catch (err) {
    log.warn(`getMediaId failed: ${err.message}`);
    return null;
  }
}

/**
 * Fetch comments directly via IG's /api/v1/media/{id}/comments/ endpoint.
 * Rides the page's session cookies — same as how we fetch reels_media.
 */
async function fetchCommentsAPI(page, mediaId, count, log) {
  try {
    const data = await page.evaluate(async (apiUrl) => {
      try {
        const r = await fetch(apiUrl, {
          credentials: 'include',
          headers: {
            'x-ig-app-id': '936619743392459',
            'x-requested-with': 'XMLHttpRequest',
            'accept': '*/*',
          },
        });
        if (!r.ok) return { __error: `HTTP ${r.status}` };
        return await r.json();
      } catch (e) {
        return { __error: e.message };
      }
    }, `${IG_BASE}/api/v1/media/${mediaId}/comments/?count=${count}&can_support_threading=true`);

    if (!data || data.__error) {
      log.warn(`comments API failed: ${data?.__error || 'empty'}`);
      return null;
    }

    // The API returns { comments: [...], comment_count, ... }
    const comments = data.comments || data.edge_media_to_parent_comment?.edges?.map(e => e.node) || [];
    return comments;
  } catch (err) {
    log.warn(`fetchCommentsAPI threw: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR 2: Click "View all comments" to trigger lazy load
// ─────────────────────────────────────────────────────────────────────────────

async function clickViewAllComments(page, log) {
  const selectors = [
    // "View all X comments" link (most common)
    'a[href*="/comments/"]',
    // Text-based selectors for "View all" / "View more"
    'span:has-text("View all")',
    'button:has-text("View all")',
    'span:has-text("comments")',
    // The comment input area (clicking near it can trigger load)
    'textarea[placeholder*="comment"]',
    'input[placeholder*="comment"]',
  ];

  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      const visible = await loc.isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) {
        log.info(`clicking comments trigger: ${sel}`);
        await loc.click({ timeout: 3000 }).catch(() => {});
        return true;
      }
    } catch {}
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCRAPER
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeComments(page, payload, log) {
  const postUrl = urlFromPayload(payload);
  if (!postUrl) throw new Error('payload.shortcode or payload.url is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200));

  // Set up GraphQL response capture BEFORE navigation (Vector 3 — passive)
  const captured = [];
  const onResponse = async (resp) => {
    const url = resp.url();
    // Also capture /api/v1/media/*/comments/ responses
    if (!/instagram\.com\/(graphql\/query|api\/graphql|api\/v1\/media)/.test(url)) return;
    try {
      const txt = await resp.text();
      if (
        txt.includes('edge_media_to_parent_comment') ||
        txt.includes('xdt_api__v1__media') ||
        txt.includes('"comment_count"') ||
        (txt.includes('"text":') && txt.includes('"user":') && txt.includes('"username":'))
      ) {
        captured.push(txt);
      }
    } catch (_) {}
  };
  page.on('response', onResponse);

  try {
    log.info(`scrape comments -> ${postUrl} (limit=${limit})`);

    // Navigate to the post page
    const resp = await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = resp ? resp.status() : 0;
    if (status === 404) throw new Error(`post_not_found:${postUrl}`);

    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (isBlockedSignal(bodyText)) {
      const err = new Error('blocked_signal_on_post');
      err.blocked = true;
      throw err;
    }

    await humanDelay(500, 1000);

    // ── VECTOR 1: Direct API (fastest, most reliable) ──────────────────
    const mediaId = await getMediaId(page, log);
    if (mediaId) {
      log.info(`got media_id=${mediaId}, trying direct API`);
      const apiComments = await fetchCommentsAPI(page, mediaId, Math.min(limit, 50), log);
      if (Array.isArray(apiComments) && apiComments.length > 0) {
        const items = apiComments.slice(0, limit).map(normalizeNode).filter(Boolean);
        log.info(`direct API returned ${items.length} comments`);
        return items;
      }
      log.info('direct API returned empty, falling back to click + GraphQL');
    } else {
      log.info('could not extract media_id, trying click + GraphQL');
    }

    // ── VECTOR 2: Click "View all comments" + scroll ───────────────────
    // This triggers the GraphQL call that loads the comments.
    const clicked = await clickViewAllComments(page, log);
    if (clicked) {
      await sleep(1500 + randInt(0, 500));
    }

    // Also scroll the page down to trigger any lazy-loaded sections
    await page.evaluate(() => window.scrollBy(0, 600)).catch(() => {});
    await sleep(800);
    await page.evaluate(() => window.scrollBy(0, 400)).catch(() => {});

    // ── VECTOR 3: Harvest captured GraphQL responses ───────────────────
    // Extended deadline: 20s (was 14s in v3). The click + scroll give
    // the SPA time to fire the actual comments request.
    const deadline = Date.now() + 20000;
    let found = null;
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      for (const body of captured) {
        try {
          const json = JSON.parse(body);
          const arr = findCommentsInTree(json);
          if (arr && arr.length > 0) {
            if (!found || arr.length > found.length) found = arr;
          }
        } catch (_) {}
      }
      if (found && found.length >= Math.min(limit, 5)) break;
    }

    if (found && found.length > 0) {
      // Try scrolling for more if we have few comments
      if (found.length < Math.min(limit, 15)) {
        log.info(`captured ${found.length} comments; scrolling for more`);
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => {
            const lists = document.querySelectorAll('ul, [role="list"], div');
            for (const el of lists) {
              if (el.querySelectorAll('a[href^="/"]').length >= 3 && el.scrollHeight > el.clientHeight + 20) {
                el.scrollTop = el.scrollHeight;
                return;
              }
            }
            window.scrollBy(0, 600);
          }).catch(() => {});
          await sleep(900);
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
      log.info(`extracted ${items.length} comments for ${postUrl} (click+GraphQL path)`);
      return items;
    }

    // ── LAST RESORT: try the API one more time with a broader search ───
    // Sometimes the media_id extraction fails on first try but the page
    // has loaded more data by now.
    if (!mediaId) {
      const retryId = await getMediaId(page, log);
      if (retryId) {
        const retryComments = await fetchCommentsAPI(page, retryId, Math.min(limit, 50), log);
        if (Array.isArray(retryComments) && retryComments.length > 0) {
          const items = retryComments.slice(0, limit).map(normalizeNode).filter(Boolean);
          log.info(`retry API returned ${items.length} comments`);
          return items;
        }
      }
    }

    log.warn(`no comments captured for ${postUrl} (all 3 vectors failed)`);
    return [];
  } finally {
    page.off('response', onResponse);
  }
}

module.exports = { scrapeComments };
