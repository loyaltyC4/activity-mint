/**
 * Comments scraper (v2 - robust DOM after SPA render).
 *
 * IG's post page is an SPA shell - inline JSON has no comment data, so we
 * navigate to /p/{shortcode}/ and wait for the comments list to mount in
 * the DOM. Then we click "View more comments" a few times to expand the
 * visible window, and walk the rendered tree to extract each commenter.
 *
 * For an isolated comments fetch from a single post the DOM-scrape approach
 * is fast enough (~3-5s including a couple of expansion clicks). The
 * orchestrator's batch endpoint is the right place to parallelize comment
 * fetches across multiple posts of one target.
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

/**
 * Walk the post DOM and return comment rows. We assume the comments are
 * rendered as anchor + text spans inside one or more <ul> lists nested
 * under a section that ALSO contains the post's main image/video. The
 * post caption is the first such row by author == post owner; we skip it.
 */
async function extractCommentsFromDom(page, limit, postOwnerUsername) {
  return page.evaluate(({ max, owner }) => {
    const out = [];
    const seen = new Set();

    // Comment rows: each has an <a> linking to /username/ and one or more
    // <span> elements with the comment text. We walk every <a role="link">
    // pointing to a profile URL, then look at its sibling/parent text spans.
    const anchors = document.querySelectorAll('a[role="link"][href^="/"], a[href^="/"]');
    for (const a of anchors) {
      if (out.length >= max) break;
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
      if (!m) continue;
      const uname = m[1];
      if (['explore', 'reels', 'direct', 'accounts', 'p', 'tv', 'stories', 'about', 'developer', 'web'].includes(uname)) continue;
      // Skip the post owner's own caption row (first occurrence is usually them)
      // Heuristic: an anchor whose closest <article> is the post itself, and
      // whose text equals the username. We let the dedup loop below skip
      // multiple captions from the same owner.

      // Walk up to find a "row" container that includes text spans
      let row = a;
      for (let i = 0; i < 8 && row.parentElement; i++) {
        row = row.parentElement;
        // Heuristic: a comment row contains at least one <span> with text
        // longer than the username itself, and not the global navigation
        if (row.querySelectorAll('span').length >= 1) {
          // Skip if this row is the top-level page chrome
          if (row.tagName === 'HEADER' || row.tagName === 'NAV') { row = a; continue; }
          break;
        }
      }
      // Collect text from spans inside the row, filter out username, like counts, reply counts
      let text = '';
      const spans = row.querySelectorAll('span');
      for (const sp of spans) {
        const t = (sp.innerText || '').trim();
        if (!t || t === uname) continue;
        if (/^\d+\s*(likes?|replies?|reply|like|w|d|h|m|s|hour|min|sec|day|week)/i.test(t)) continue;
        if (/^(reply|like|liked|view replies|see translation|view all|view more)/i.test(t)) continue;
        if (t.length > 1500) continue;
        text = t;
        break;
      }
      if (!text) continue;
      // Dedup by (username, first 80 chars of text)
      const key = `${uname}::${text.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Skip the post owner's caption (first comment-like row from owner)
      if (owner && uname === owner && !out.length) continue;

      const img = row.querySelector('img');
      const profilePicUrl = img ? (img.getAttribute('src') || null) : null;
      const isVerified = !!row.querySelector('svg[aria-label="Verified"], svg[aria-label="verified"]');
      // Like count: look for "<N> likes" or "1 like"
      let likeCount = 0;
      for (const sp of spans) {
        const t = (sp.innerText || '').trim();
        const lm = t.match(/^(\d+)\s*likes?$/i);
        if (lm) { likeCount = parseInt(lm[1], 10); break; }
      }
      // Timestamp from <time datetime="...">
      const time = row.querySelector('time[datetime]');
      const timestamp = time ? time.getAttribute('datetime') : null;

      out.push({
        username: uname,
        fullName: null,
        profilePicUrl,
        isVerified,
        text,
        likeCount,
        timestamp,
      });
    }
    return out;
  }, { max: limit, owner: postOwnerUsername }).catch(() => []);
}

/**
 * Click "View more comments" / "Load more" / down-arrow buttons up to N times
 * to grow the visible comment list.
 */
async function expandComments(page, rounds, log) {
  for (let i = 0; i < rounds; i++) {
    const candidates = [
      page.getByRole('button', { name: /view (more|all) comments?/i }).first(),
      page.getByRole('button', { name: /load more comments?/i }).first(),
      page.locator('button[aria-label*="view comments" i], button[aria-label*="load more" i], button[aria-label*="more comments" i]').first(),
    ];
    let clicked = false;
    for (const c of candidates) {
      if (await c.isVisible({ timeout: 600 }).catch(() => false)) {
        try { await c.click({ timeout: 2000 }); clicked = true; break; } catch (_) {}
      }
    }
    if (!clicked) break;
    await sleep(700 + randInt(50, 250));
  }
}

async function scrapeComments(page, payload, log) {
  const postUrl = urlFromPayload(payload);
  if (!postUrl) throw new Error('payload.shortcode or payload.url is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200));

  log.info(`scrape comments -> ${postUrl} (limit=${limit})`);
  const resp = await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(1200, 2200);

  const status = resp ? resp.status() : 0;
  if (status === 404) throw new Error(`post_not_found:${postUrl}`);

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_post');
    err.blocked = true;
    throw err;
  }

  // Wait for the SPA to mount the comments list. Use the presence of any
  // image inside an <article> as a proxy for "post page is rendered".
  try {
    await page.waitForSelector('article img, main img', { timeout: 12000 });
  } catch (_) {}
  await humanDelay(700, 1400);

  // Identify the post owner from the page so we can skip the caption row.
  // Owner is in the og:url meta tag as /username/.
  let owner = null;
  try {
    const og = await page.locator('meta[property="og:url"]').first().getAttribute('content', { timeout: 1500 }).catch(() => null);
    if (og) {
      const m = og.match(/instagram\.com\/([A-Za-z0-9._]+)/);
      if (m) owner = m[1];
    }
  } catch (_) {}

  // Expand a few rounds to grow the visible list
  await expandComments(page, 4, log);

  const comments = await extractCommentsFromDom(page, limit, owner);
  log.info(`extracted ${comments.length} comments for ${postUrl}`);
  return comments.slice(0, limit);
}

module.exports = { scrapeComments };
