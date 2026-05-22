/**
 * Followers / Following modal scraper.
 *
 * Approach:
 *  1. Navigate to /{username}/
 *  2. Click the "followers" or "following" link in the header
 *  3. Wait for the modal to mount; locate its scroll container
 *  4. Scroll-paginate until we've gathered `limit` entries (or no growth)
 *  5. Extract each row's username / fullName / avatar / verified / private
 *
 * Strategy supports either direction by passing `mode = "followers" | "following"`.
 */

'use strict';

const { humanDelay, sleep, randInt, isBlockedSignal } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

/**
 * Open the followers/following modal by clicking the header link.
 * Returns the dialog/role=dialog locator on success, else null.
 */
async function openModal(page, username, mode, log) {
  // The link is an <a> whose href ends with /followers/ or /following/
  const hrefTail = mode === 'followers' ? '/followers/' : '/following/';
  const link = page.locator(`a[href$="${hrefTail}"]`).first();
  try {
    await link.waitFor({ state: 'visible', timeout: 15000 });
  } catch (err) {
    log.warn(`${mode} link not visible for ${username}: ${err.message}`);
    return null;
  }
  await link.click().catch((err) => log.warn(`${mode} link click failed: ${err.message}`));

  // Wait for the dialog
  const dialog = page.locator('div[role="dialog"]').last();
  try {
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
  } catch (err) {
    log.warn(`${mode} dialog never appeared: ${err.message}`);
    return null;
  }
  return dialog;
}

/**
 * Find the scrollable inner container of the modal. Instagram nests several
 * scroll containers; we pick the one whose `scrollHeight > clientHeight`.
 */
async function findScrollContainer(page, dialog) {
  return dialog.evaluateHandle((root) => {
    const cands = root.querySelectorAll('div');
    let best = null;
    let bestScore = 0;
    for (const el of cands) {
      const cs = window.getComputedStyle(el);
      if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') continue;
      const score = el.scrollHeight - el.clientHeight;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  });
}

/**
 * Extract user rows currently in the DOM. We look at <a href="/{u}/"> anchors
 * within the dialog that contain an <img alt="..."> profile pic.
 */
async function extractRows(dialog) {
  return dialog.evaluate((root) => {
    const seen = new Map();
    const anchors = root.querySelectorAll('a[role="link"][href^="/"]');
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
      if (!m) continue;
      const uname = m[1];
      // Skip non-username paths like /explore/, /reels/, /direct/, etc.
      if (['explore', 'reels', 'direct', 'accounts', 'p', 'tv'].includes(uname)) continue;
      if (seen.has(uname)) continue;

      // Find the row container (the closest ancestor that also holds the avatar img)
      let row = a;
      for (let i = 0; i < 6 && row.parentElement; i++) {
        if (row.parentElement.querySelector('img')) { row = row.parentElement; break; }
        row = row.parentElement;
      }
      const img = row.querySelector('img');
      const profilePicUrl = img ? (img.getAttribute('src') || null) : null;

      // Full name: usually a span within the row that ISN'T the username
      let fullName = null;
      const spans = row.querySelectorAll('span');
      for (const sp of spans) {
        const txt = (sp.innerText || '').trim();
        if (!txt) continue;
        if (txt === uname) continue;
        if (txt.toLowerCase().startsWith('follow')) continue; // skip "Follow" button labels
        if (txt.length > 80) continue;
        // Prefer the first non-username text span
        fullName = txt;
        break;
      }

      // Verified badge presence
      const isVerified = !!row.querySelector('svg[aria-label="Verified"], svg[aria-label="verified"]');

      seen.set(uname, {
        username: uname,
        fullName,
        profilePicUrl,
        isPrivate: false, // we can only know this from a deeper fetch; default false
        isVerified,
      });
    }
    return Array.from(seen.values());
  });
}

async function collectByScrolling(page, dialog, scrollHandle, limit, log) {
  const collected = new Map();
  let stallCount = 0;
  const maxStalls = 8;
  const maxIters = 400;

  for (let i = 0; i < maxIters; i++) {
    const rows = await extractRows(dialog).catch(() => []);
    for (const r of rows) {
      if (!collected.has(r.username)) collected.set(r.username, r);
    }
    if (collected.size >= limit) {
      log.info(`collected limit reached: ${collected.size} >= ${limit}`);
      break;
    }
    // Scroll
    const grew = await page.evaluate((el) => {
      if (!el) return false;
      const before = el.scrollHeight;
      el.scrollBy(0, el.clientHeight * 0.9);
      return el.scrollHeight !== before || el.scrollTop > 0;
    }, scrollHandle).catch(() => false);
    await sleep(500 + randInt(50, 250));
    // Determine if new content appeared in the next pass
    const sizeBefore = collected.size;
    const newRows = await extractRows(dialog).catch(() => []);
    for (const r of newRows) {
      if (!collected.has(r.username)) collected.set(r.username, r);
    }
    if (collected.size === sizeBefore && !grew) {
      stallCount++;
      if (stallCount >= maxStalls) {
        log.info(`stall threshold reached at ${collected.size} entries`);
        break;
      }
      await sleep(800);
    } else {
      stallCount = 0;
    }
  }

  return Array.from(collected.values()).slice(0, limit);
}

async function scrapeList(page, payload, mode, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');
  const limit = Math.max(1, Math.min(parseInt(payload?.limit ?? 200, 10) || 200, 5000));

  const url = `${IG_BASE}/${encodeURIComponent(username)}/`;
  log.info(`scrape ${mode} -> ${username} (limit=${limit})`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(800, 1500);

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_profile');
    err.blocked = true;
    throw err;
  }

  const dialog = await openModal(page, username, mode, log);
  if (!dialog) throw new Error(`${mode}_modal_failed_to_open`);

  await humanDelay(600, 1200);

  const scrollHandle = await findScrollContainer(page, dialog).catch(() => null);
  if (!scrollHandle) {
    log.warn('no scroll container found inside dialog — returning first-page rows only');
    const rows = await extractRows(dialog).catch(() => []);
    return rows.slice(0, limit);
  }

  const rows = await collectByScrolling(page, dialog, scrollHandle, limit, log);

  // Re-check for late-appearing block signal
  const after = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
  if (isBlockedSignal(after) && rows.length === 0) {
    const err = new Error('blocked_signal_during_scroll');
    err.blocked = true;
    throw err;
  }

  return rows;
}

module.exports = {
  scrapeFollowers: (page, payload, log) => scrapeList(page, payload, 'followers', log),
  scrapeFollowing: (page, payload, log) => scrapeList(page, payload, 'following', log),
};
