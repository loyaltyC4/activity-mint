/**
 * Followers / Following modal scraper.
 *
 * Approach:
 *  1. Navigate to /{username}/
 *  2. Click the "followers" or "following" element in the header (multi-selector race)
 *  3. Wait for the modal to mount; locate its scroll container
 *  4. Scroll-paginate until we've gathered `limit` entries (or no growth)
 *  5. Extract each row's username / fullName / avatar / verified / private
 *
 * Strategy supports either direction by passing `mode = "followers" | "following"`.
 */

'use strict';

const fs = require('fs');
const { humanDelay, sleep, randInt, isBlockedSignal } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

/**
 * Open the followers/following modal by clicking the header element.
 * IG has cycled through several markup shapes for this element:
 *   - <a href="/{u}/followers/">  (older)
 *   - <a role="link" href="/{u}/followers/"> (current)
 *   - <button> ... </button> with JS-handled SPA click (sometimes)
 *   - text-only span inside a clickable parent
 * Tries each in order, then falls back to a getByRole('link', { name: /followers/i }).
 * Returns the dialog locator on success, else null.
 */
async function openModal(page, username, mode, log) {
  const hrefTail = mode === 'followers' ? '/followers/' : '/following/';

  // ─── Wait for profile header hydration ──────────────────────────────────
  // The followers/following anchors are rendered after the IG SPA chunk
  // hydrates. With a fast network goto + only a static ~2s humanDelay we
  // sometimes race the hydration, find no candidate, falsely conclude the
  // link is missing, and dump a half-rendered page (body snippet = sidebar
  // text like "Messages"). Wait up to 15s for EITHER followers or following
  // anchor to actually exist before we start the click race. Accept either
  // because some private-but-followed profiles only render one direction
  // depending on the viewer's relationship.
  try {
    await page.waitForFunction(
      (u) => {
        const sel = `a[href*="/${u}/followers/"], a[href*="/${u}/following/"], a[href$="/${u}/followers/"], a[href$="/${u}/following/"]`;
        return !!document.querySelector(sel);
      },
      username,
      { timeout: 15000 },
    );
  } catch (_) {
    log.warn(`profile header hydration timed out for ${username} (${mode}) — will still try candidate race`);
  }

  const candidates = [
    page.locator(`a[href$="${hrefTail}"]`).first(),
    page.locator(`a[role="link"][href$="${hrefTail}"]`).first(),
    page.locator(`a[href*="${hrefTail}"]`).first(),
    page.getByRole('link', { name: new RegExp(`^[\\d,.kKmMbB]+\\s+${mode}\\b`, 'i') }).first(),
    page.getByRole('button', { name: new RegExp(`^[\\d,.kKmMbB]+\\s+${mode}\\b`, 'i') }).first(),
    page.locator(`a:has-text("${mode}")`).first(),
  ];

  let clicked = false;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    try {
      const visible = await cand.isVisible({ timeout: 1500 }).catch(() => false);
      if (!visible) continue;
      await cand.click({ timeout: 3000 });
      log.info(`${mode} link clicked via candidate #${i}`);
      clicked = true;
      break;
    } catch (err) {
      log.warn(`${mode} candidate #${i} click failed: ${err.message}`);
    }
  }

  if (!clicked) {
    // Capture what the profile page looks like so we can update selectors next time
    try {
      const url = page.url();
      const title = await page.title().catch(() => '');
      const body = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      log.warn(`${mode} link not found. url=${url} title=${title}`);
      log.warn(`body snippet: ${(body||'').replace(/\s+/g,' ').slice(0,400)}`);
      await page.screenshot({ path: `/app/profile/last_${mode}_failure.png`, fullPage: false }).catch(() => {});
      const html = await page.content().catch(() => '');
      if (html) fs.writeFileSync(`/app/profile/last_${mode}_failure.html`, html);
    } catch (_) {}
    return null;
  }

  // Wait for the dialog. IG uses role=dialog reliably for this modal.
  const dialog = page.locator('div[role="dialog"]').last();
  try {
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
  } catch (err) {
    log.warn(`${mode} dialog never appeared: ${err.message}`);
    try {
      await page.screenshot({ path: `/app/profile/last_${mode}_failure.png`, fullPage: false }).catch(() => {});
      const html = await page.content().catch(() => '');
      if (html) fs.writeFileSync(`/app/profile/last_${mode}_failure.html`, html);
    } catch (_) {}
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
 * Extract user rows currently in the DOM.
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
      if (['explore', 'reels', 'direct', 'accounts', 'p', 'tv'].includes(uname)) continue;
      if (seen.has(uname)) continue;

      let row = a;
      for (let i = 0; i < 6 && row.parentElement; i++) {
        if (row.parentElement.querySelector('img')) { row = row.parentElement; break; }
        row = row.parentElement;
      }
      const img = row.querySelector('img');
      const profilePicUrl = img ? (img.getAttribute('src') || null) : null;

      let fullName = null;
      const spans = row.querySelectorAll('span');
      for (const sp of spans) {
        const txt = (sp.innerText || '').trim();
        if (!txt) continue;
        if (txt === uname) continue;
        if (txt.toLowerCase().startsWith('follow')) continue;
        if (txt.length > 80) continue;
        fullName = txt;
        break;
      }

      const isVerified = !!row.querySelector('svg[aria-label="Verified"], svg[aria-label="verified"]');

      seen.set(uname, {
        username: uname,
        fullName,
        profilePicUrl,
        isPrivate: false,
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
    const grew = await page.evaluate((el) => {
      if (!el) return false;
      const before = el.scrollHeight;
      el.scrollBy(0, el.clientHeight * 0.9);
      return el.scrollHeight !== before || el.scrollTop > 0;
    }, scrollHandle).catch(() => false);
    await sleep(500 + randInt(50, 250));
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
  await humanDelay(1200, 2200);  // give SPA chunks time to hydrate

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
