/**
 * Shared helpers for Instagram scrapers.
 *
 * Keep this module side-effect free; everything is exported as pure functions.
 */

'use strict';

/** Sleep for `ms` milliseconds. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random integer in [min, max] inclusive. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Human-like delay between actions. Default 50–300 ms.
 * Pass a wider window for things that should feel like "reading".
 */
async function humanDelay(min = 50, max = 300) {
  await sleep(randInt(min, max));
}

/**
 * Wait for a selector but never throw — returns the locator if it appears,
 * or null on timeout. Default 15s timeout.
 */
async function safeWaitForSelector(page, selector, options = {}) {
  const timeout = options.timeout ?? 15000;
  try {
    await page.waitForSelector(selector, { timeout, state: options.state ?? 'visible' });
    return page.locator(selector).first();
  } catch (_err) {
    return null;
  }
}

/**
 * Try multiple selectors in order; return the first one that becomes visible.
 * Returns { selector, locator } or null.
 */
async function raceSelectors(page, selectors, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      try {
        if (await loc.isVisible({ timeout: 250 }).catch(() => false)) {
          return { selector: sel, locator: loc };
        }
      } catch (_err) {
        // ignore; keep racing
      }
    }
    await sleep(150);
  }
  return null;
}

/**
 * Click safely — no throw if the element isn't there.
 * Returns true on click, false otherwise.
 */
async function safeClick(page, selector, options = {}) {
  try {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: options.timeout ?? 2000 }).catch(() => false)) {
      await loc.click({ timeout: options.timeout ?? 5000 });
      return true;
    }
  } catch (_err) {
    // fall through to false
  }
  return false;
}

/**
 * Try clicking any button/role=button that contains one of the given texts.
 * Used for dismissing Instagram dialogs ("Not Now", "Not now", "Cancel", etc.).
 * Returns true if something was clicked.
 */
async function clickByText(page, texts, timeout = 3000) {
  for (const text of texts) {
    // Try role=button first, then any element containing the text
    const roleLoc = page.getByRole('button', { name: new RegExp(`^\\s*${escapeRegex(text)}\\s*$`, 'i') }).first();
    try {
      if (await roleLoc.isVisible({ timeout: 500 }).catch(() => false)) {
        await roleLoc.click({ timeout });
        return true;
      }
    } catch (_err) {
      // continue
    }
    // Generic text fallback (Instagram sometimes uses <div role="button"> with no accessible name)
    const textLoc = page.locator(`text=${text}`).first();
    try {
      if (await textLoc.isVisible({ timeout: 500 }).catch(() => false)) {
        await textLoc.click({ timeout });
        return true;
      }
    } catch (_err) {
      // continue
    }
  }
  return false;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect rate-limit / challenge / block signals in either page content or an
 * error message. Returns true if any blocking signal is found.
 */
function isBlockedSignal(input) {
  if (!input) return false;
  const text = typeof input === 'string' ? input.toLowerCase() : String(input).toLowerCase();
  const needles = [
    'please wait a few minutes',
    'try again later',
    'challenge_required',
    'challenge required',
    'rate limit',
    'rate-limit',
    'too many requests',
    'suspicious login',
    'we detected an unusual login',
    'your account has been temporarily locked',
    'help us confirm',
    'verify your identity',
  ];
  return needles.some((n) => text.includes(n));
}

/**
 * Scroll the given element (a Locator handle) by setting scrollTop, then
 * wait for new content to settle. Returns true if scrollHeight increased.
 */
async function scrollContainer(page, containerLocator, opts = {}) {
  const step = opts.step ?? 600;
  const pause = opts.pause ?? 600;
  const before = await containerLocator.evaluate((el) => el.scrollHeight).catch(() => 0);
  await containerLocator.evaluate((el, by) => {
    el.scrollBy(0, by);
  }, step);
  await sleep(pause + randInt(50, 200));
  const after = await containerLocator.evaluate((el) => el.scrollHeight).catch(() => 0);
  return after > before;
}

/**
 * Type text with small per-keystroke jitter so it doesn't look like a paste.
 */
async function humanType(locator, text, opts = {}) {
  const minDelay = opts.minDelay ?? 30;
  const maxDelay = opts.maxDelay ?? 90;
  for (const ch of text) {
    await locator.type(ch, { delay: randInt(minDelay, maxDelay) });
  }
}

/**
 * Phase 4: ensure the page has an Instagram origin so session cookies are
 * available for direct API fetches. If we're already on www.instagram.com
 * and not on the login/challenge pages, this is a no-op (~zero latency).
 * Otherwise navigates to the IG home (~3-5s one-time cost). Subsequent
 * scrapers can call fetch() against /api/v1/* without re-navigating.
 */
async function ensureIGContext(page, log) {
  try {
    const url = page.url();
    if (
      url.startsWith('https://www.instagram.com/') &&
      !url.includes('/accounts/login') &&
      !url.includes('/challenge/')
    ) {
      return;
    }
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
  } catch (err) {
    if (log) log.warn(`ensureIGContext failed: ${err.message}`);
  }
}

module.exports = {
  sleep,
  randInt,
  humanDelay,
  safeWaitForSelector,
  raceSelectors,
  safeClick,
  clickByText,
  isBlockedSignal,
  scrollContainer,
  humanType,
  ensureIGContext,
};
