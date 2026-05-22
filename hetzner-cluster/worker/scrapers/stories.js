/**
 * Stories scraper.
 *
 * Open the user's profile, click the story ring (avatar with story border),
 * then page through each story item, recording mediaUrl, timestamp, type.
 *
 * Returns [] if there are no active stories or the story tray is private.
 */

'use strict';

const { humanDelay, sleep, isBlockedSignal, safeWaitForSelector } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

/**
 * Detect whether the profile avatar has an active story ring. We look at the
 * <header> for an <a> with href containing /stories/ — that's the click target.
 */
async function findStoryEntryPoint(page, username) {
  const sel = `header a[href^="/stories/${username}/"]`;
  const visible = await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
  return visible ? sel : null;
}

/**
 * Determine the media URL + type for the currently displayed story item.
 * Instagram swaps between <video src=...> and <img src=...>.
 */
async function readCurrentItem(page) {
  return page.evaluate(() => {
    function timeISO(el) {
      if (!el) return null;
      // Try a <time datetime="..."> element somewhere in the player
      const t = document.querySelector('time[datetime]');
      if (t) return t.getAttribute('datetime');
      return null;
    }
    // Prefer video over image (videos are the "real" story)
    const video = document.querySelector('section video[src], section video source[src]');
    if (video) {
      const src = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src');
      if (src) {
        return {
          mediaUrl: src,
          type: 'video',
          timestamp: timeISO(),
        };
      }
    }
    // Story images live inside <section> in IG's story player
    const img = document.querySelector('section img[srcset], section img[src]');
    if (img) {
      const src = img.getAttribute('src');
      if (src) {
        return {
          mediaUrl: src,
          type: 'image',
          timestamp: timeISO(),
        };
      }
    }
    return null;
  }).catch(() => null);
}

/**
 * Advance to the next story item by clicking the "Next" button or pressing ArrowRight.
 */
async function advance(page) {
  // Try button first (more reliable than keyboard when there's a chrome overlay)
  const nextBtn = page.locator('button[aria-label="Next"], button[aria-label="next"]').first();
  if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await nextBtn.click().catch(() => {});
    return true;
  }
  await page.keyboard.press('ArrowRight').catch(() => {});
  return true;
}

async function scrapeStories(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) throw new Error('payload.username is required');

  log.info(`scrape stories -> ${username}`);
  await page.goto(`${IG_BASE}/${encodeURIComponent(username)}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await humanDelay(800, 1500);

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_profile');
    err.blocked = true;
    throw err;
  }

  const entryPoint = await findStoryEntryPoint(page, username);
  if (!entryPoint) {
    log.info(`no story ring for ${username} — returning []`);
    return [];
  }

  await page.locator(entryPoint).first().click().catch((err) => log.warn(`story click failed: ${err.message}`));
  // Wait for the story player to mount
  const player = await safeWaitForSelector(page, 'section img, section video', { timeout: 15000 });
  if (!player) {
    log.warn('story player never mounted');
    return [];
  }
  await humanDelay(500, 1000);

  const out = [];
  const seenUrls = new Set();
  const maxItems = Math.min(parseInt(payload?.limit ?? 50, 10) || 50, 200);

  for (let i = 0; i < maxItems; i++) {
    const item = await readCurrentItem(page);
    if (item && item.mediaUrl && !seenUrls.has(item.mediaUrl)) {
      seenUrls.add(item.mediaUrl);
      out.push({
        mediaUrl: item.mediaUrl,
        type: item.type || 'image',
        timestamp: item.timestamp || null,
      });
    }

    // Try to advance — if URL doesn't change after advance + delay, we're done
    const beforeUrl = page.url();
    await advance(page);
    await sleep(700);
    const nowUrl = page.url();
    // If IG bounced us back to the profile, the story tray is done
    if (nowUrl === beforeUrl) {
      // also try one more read in case the DOM updated but URL didn't
      const next = await readCurrentItem(page);
      if (!next || (next.mediaUrl && seenUrls.has(next.mediaUrl))) {
        // Likely no progress — stop
        break;
      }
    }
    if (!nowUrl.includes('/stories/')) {
      break;
    }
  }

  return out;
}

module.exports = { scrapeStories };
