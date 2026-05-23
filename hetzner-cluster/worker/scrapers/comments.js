/**
 * Comments scraper.
 *
 * Given a single post (by shortcode OR full IG URL), navigate to the post
 * page and pull the list of comments and their authors. Returns an array of:
 *   {
 *     username, fullName, profilePicUrl, isVerified,
 *     text, likeCount, timestamp,
 *   }
 *
 * The dashboard's "top commenters" feature aggregates this across multiple
 * posts of one target, ranking commenters by frequency. That aggregation
 * lives on the proxy/orchestrator side so we can fan post-fetches out
 * across multiple workers in parallel. This scraper only handles ONE post.
 *
 * payload:
 *   { shortcode | url, limit? }    // limit defaults to 50, max 200
 */

'use strict';

const { humanDelay, sleep, isBlockedSignal, safeWaitForSelector, randInt } = require('./utils');

const IG_BASE = 'https://www.instagram.com';
const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,20}$/;

function urlFromPayload(payload) {
  if (payload?.url && typeof payload.url === 'string') {
    if (payload.url.startsWith('http')) return payload.url;
    return `${IG_BASE}${payload.url.startsWith('/') ? '' : '/'}${payload.url}`;
  }
  if (payload?.shortcode && SHORTCODE_RE.test(payload.shortcode)) {
    return `${IG_BASE}/p/${payload.shortcode}/`;
  }
  return null;
}

/**
 * Pull the comment edges out of the post page's inline JSON.
 * IG ships them under edge_media_to_parent_comment / edge_media_to_comment.
 */
function decodeStr(v) {
  if (v == null) return null;
  return v.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
}

async function extractCommentsFromInline(page, limit) {
  const html = await page.content();
  const out = [];

  const edgesRe = /"edge_media_to_(?:parent_)?comment"\s*:\s*\{\s*"count"[^{}]*"edges"\s*:\s*\[([\s\S]*?)\](?:\s*,\s*"page_info"|\s*\})/g;
  let match;
  while ((match = edgesRe.exec(html)) !== null) {
    const edgesBody = match[1];
    const nodeRe = /"node"\s*:\s*\{/g;
    let m2;
    const nodeStarts = [];
    while ((m2 = nodeRe.exec(edgesBody)) !== null) {
      nodeStarts.push(m2.index + m2[0].length);
    }
    for (let i = 0; i < nodeStarts.length && out.length < limit; i++) {
      const start = nodeStarts[i];
      let depth = 1, end = start;
      while (end < edgesBody.length && depth > 0) {
        const ch = edgesBody[end];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        end++;
      }
      const blob = edgesBody.slice(start, end - 1);
      const pick = (re) => {
        const x = blob.match(re);
        return x ? x[1] : null;
      };
      const text = decodeStr(pick(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/));
      // Owner is the commenter
      const ownerBlobRe = /"owner"\s*:\s*\{([\s\S]*?)\}\s*,/;
      const ownerBlob = (blob.match(ownerBlobRe) || [])[1] || '';
      const username = pick(new RegExp('"username"\\s*:\\s*"([^"]+)"')) ||
                      (ownerBlob.match(/"username"\s*:\s*"([^"]+)"/) || [])[1];
      if (!username) continue;
      const ownerPick = (re) => {
        const x = ownerBlob.match(re);
        return x ? x[1] : null;
      };
      const fullName = decodeStr(ownerPick(/"full_name"\s*:\s*"((?:[^"\\]|\\.)*)"/));
      const profilePicUrl = decodeStr(ownerPick(/"profile_pic_url"\s*:\s*"((?:[^"\\]|\\.)*)"/));
      const isVerified = ownerPick(/"is_verified"\s*:\s*(true|false)/) === 'true';
      const likeCount = parseInt(pick(/"edge_liked_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || '0', 10);
      const ts = pick(/"created_at"\s*:\s*(\d+)/);
      const timestamp = ts ? new Date(parseInt(ts, 10) * 1000).toISOString() : null;

      if (out.find((c) => c.username === username && c.text === text)) continue;
      out.push({
        username,
        fullName: fullName || null,
        profilePicUrl: profilePicUrl || null,
        isVerified,
        text: text || '',
        likeCount,
        timestamp,
      });
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/**
 * DOM fallback: read visible comments from the post page DOM. Used when the
 * inline JSON path returns nothing (rare but possible for some IG layouts).
 */
async function extractCommentsFromDom(page, limit) {
  return page.evaluate((maxN) => {
    const out = [];
    const seen = new Set();
    // Comment rows: each has a link to /username/ and a span containing text.
    // We pick rows under <ul> in the dialog or main column.
    const anchors = document.querySelectorAll('a[role="link"][href^="/"]');
    for (const a of anchors) {
      if (out.length >= maxN) break;
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
      if (!m) continue;
      const uname = m[1];
      if (['explore', 'reels', 'direct', 'accounts', 'p', 'tv', 'stories'].includes(uname)) continue;
      // Walk up to a row that has a text-bearing sibling
      let row = a;
      for (let i = 0; i < 5 && row.parentElement; i++) {
        row = row.parentElement;
        if (row.querySelector('span')) break;
      }
      // Find the first span whose text isn't the username
      let text = '';
      for (const sp of row.querySelectorAll('span')) {
        const t = (sp.innerText || '').trim();
        if (!t || t === uname || /^\d+\s*(likes?|replies?)/i.test(t)) continue;
        text = t;
        break;
      }
      if (!text) continue;
      const key = `${uname}::${text.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const img = row.querySelector('img');
      const profilePicUrl = img ? img.getAttribute('src') : null;
      out.push({
        username: uname,
        fullName: null,
        profilePicUrl,
        isVerified: !!row.querySelector('svg[aria-label="Verified"], svg[aria-label="verified"]'),
        text,
        likeCount: 0,
        timestamp: null,
      });
    }
    return out;
  }, limit).catch(() => []);
}

async function scrapeComments(page, payload, log) {
  const postUrl = urlFromPayload(payload);
  if (!postUrl) throw new Error('payload.shortcode or payload.url is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200));

  log.info(`scrape comments -> ${postUrl} (limit=${limit})`);
  const resp = await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(900, 1800);

  const status = resp ? resp.status() : 0;
  if (status === 404) throw new Error(`post_not_found:${postUrl}`);

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_post');
    err.blocked = true;
    throw err;
  }

  // Try inline JSON first
  let comments = await extractCommentsFromInline(page, limit);

  // If we got few/none, try clicking "Load more comments" then DOM scrape
  if (comments.length < Math.min(limit, 10)) {
    log.info(`inline yielded ${comments.length} comments; attempting DOM scrape`);
    // Try a few rounds of "Load more comments" button clicks to grow the list
    for (let i = 0; i < 3; i++) {
      const more = page.locator('button[aria-label*="comment" i], button:has-text("Load more"), button:has-text("View more comments")').first();
      if (!(await more.isVisible({ timeout: 800 }).catch(() => false))) break;
      await more.click({ timeout: 2000 }).catch(() => {});
      await sleep(700 + randInt(50, 250));
    }
    const dom = await extractCommentsFromDom(page, limit);
    // Merge, prefer inline (richer fields)
    const seen = new Set(comments.map((c) => c.username + '::' + (c.text || '').slice(0, 80)));
    for (const d of dom) {
      const k = d.username + '::' + d.text.slice(0, 80);
      if (!seen.has(k)) { comments.push(d); seen.add(k); }
      if (comments.length >= limit) break;
    }
  }

  log.info(`extracted ${comments.length} comments for ${postUrl}`);
  return comments.slice(0, limit);
}

module.exports = { scrapeComments };
