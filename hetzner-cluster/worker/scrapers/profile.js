/**
 * Profile scraper.
 *
 * Strategy: hit the user's profile page, but rely on Instagram's embedded
 * JSON for the heavy fields (followers/following count, bio, verified, etc.).
 * DOM scraping is only a fallback because Instagram's HTML changes often.
 */

'use strict';

const { humanDelay, isBlockedSignal } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

/** Parse a follower-count style string ("12.3k", "1,234,567") into a number. */
function parseCount(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().toLowerCase().replace(/[,\s]/g, '');
  if (!s) return null;
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([kmb]?)$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const suf = m[2];
  if (suf === 'k') n *= 1_000;
  else if (suf === 'm') n *= 1_000_000;
  else if (suf === 'b') n *= 1_000_000_000;
  return Math.round(n);
}

/**
 * Try to find an inline `<script>` containing user data. Instagram embeds it
 * via "additionalDataLoaded" / "PolarisProfilePageContentDirectQuery" /
 * "PolarisProfilePageContentQuery". We just grep for `"username":"<x>"` and
 * extract surrounding fields.
 */
async function extractFromInlineJSON(page, targetUsername) {
  try {
    const html = await page.content();
    // 1) Try meta tags first — they're stable
    const meta = await page.evaluate(() => {
      function get(name) {
        const el = document.querySelector(`meta[property="${name}"]`) ||
                   document.querySelector(`meta[name="${name}"]`);
        return el ? el.getAttribute('content') : null;
      }
      return {
        ogTitle: get('og:title'),
        ogImage: get('og:image'),
        ogDescription: get('og:description'),
      };
    }).catch(() => null);

    // og:description typically looks like:
    //  "1,234 Followers, 56 Following, 78 Posts - See Instagram photos and videos from Name (@user)"
    let followers = null, following = null, posts = null;
    if (meta?.ogDescription) {
      const m = meta.ogDescription.match(/([\d.,]+\s*[KMBkmb]?)\s+Followers,\s+([\d.,]+\s*[KMBkmb]?)\s+Following,\s+([\d.,]+\s*[KMBkmb]?)\s+Posts/i);
      if (m) {
        followers = parseCount(m[1]);
        following = parseCount(m[2]);
        posts = parseCount(m[3]);
      }
    }

    // 2) Look in inline JSON for username, full_name, biography, is_private, is_verified, profile_pic_url
    let fullName = null, biography = null, isPrivate = null, isVerified = null, profilePicUrl = null, foundUsername = null;
    const userBlobRe = new RegExp(
      `"username"\\s*:\\s*"${targetUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,4000}`,
      'i',
    );
    const m = html.match(userBlobRe);
    if (m) {
      const blob = m[0];
      foundUsername = targetUsername;
      const pick = (re) => {
        const x = blob.match(re);
        return x ? x[1] : null;
      };
      fullName = pick(/"full_name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      biography = pick(/"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      profilePicUrl = pick(/"profile_pic_url(?:_hd)?"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const priv = pick(/"is_private"\s*:\s*(true|false)/);
      const ver = pick(/"is_verified"\s*:\s*(true|false)/);
      if (priv != null) isPrivate = priv === 'true';
      if (ver != null) isVerified = ver === 'true';
      // Counts inside blob (more reliable than meta when present)
      const fc = pick(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      const fgc = pick(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      const pc = pick(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
      if (fc) followers = parseInt(fc, 10);
      if (fgc) following = parseInt(fgc, 10);
      if (pc) posts = parseInt(pc, 10);
      // Decode unicode escapes
      const decode = (v) => v == null ? v : v.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
      fullName = decode(fullName);
      biography = decode(biography);
      profilePicUrl = decode(profilePicUrl);
    }

    // 3) Fall back to og:image for avatar if we didn't find one
    if (!profilePicUrl && meta?.ogImage) {
      profilePicUrl = meta.ogImage;
    }

    return {
      username: foundUsername || targetUsername,
      fullName: fullName || null,
      followers,
      following,
      posts,
      bio: biography || null,
      isVerified: isVerified ?? false,
      isPrivate: isPrivate ?? false,
      profilePicUrl: profilePicUrl || null,
    };
  } catch (_err) {
    return null;
  }
}

/**
 * DOM-only fallback for the counts (used if inline JSON parsing failed).
 * Instagram's profile header has three <li>s with `_ac2a` class or similar.
 */
async function extractCountsFromDom(page) {
  return page.evaluate(() => {
    function readSpanCount(el) {
      if (!el) return null;
      // Some IG layouts use title="1234" on a span when count is large
      const titled = el.querySelector('[title]');
      if (titled?.getAttribute('title')) {
        const t = titled.getAttribute('title').replace(/[,\s]/g, '');
        if (/^\d+$/.test(t)) return parseInt(t, 10);
      }
      const txt = (el.innerText || '').trim().split(/\s+/)[0];
      return txt || null;
    }
    const headers = document.querySelectorAll('header section ul li, header section li');
    if (!headers.length) return {};
    // Order: posts, followers, following
    const out = {};
    if (headers[0]) out.posts = readSpanCount(headers[0]);
    if (headers[1]) out.followers = readSpanCount(headers[1]);
    if (headers[2]) out.following = readSpanCount(headers[2]);
    return out;
  }).catch(() => ({}));
}

async function scrapeProfile(page, payload, log) {
  const username = (payload?.username || '').trim().replace(/^@/, '');
  if (!username) {
    throw new Error('payload.username is required');
  }

  const url = `${IG_BASE}/${encodeURIComponent(username)}/`;
  log.info(`scrape profile -> ${username}`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanDelay(800, 1600);

  const status = resp ? resp.status() : 0;
  if (status === 404) {
    throw new Error(`profile_not_found:${username}`);
  }

  // Block / challenge sniff
  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (isBlockedSignal(bodyText)) {
    const err = new Error('blocked_signal_on_profile');
    err.blocked = true;
    throw err;
  }

  const data = await extractFromInlineJSON(page, username);
  if (data && (data.followers != null || data.following != null || data.posts != null)) {
    return [data];
  }

  // Fallback: DOM scrape
  const fallback = await extractCountsFromDom(page);
  const merged = {
    username,
    fullName: data?.fullName || null,
    followers: data?.followers ?? (typeof fallback.followers === 'string' ? parseCount(fallback.followers) : fallback.followers ?? null),
    following: data?.following ?? (typeof fallback.following === 'string' ? parseCount(fallback.following) : fallback.following ?? null),
    posts: data?.posts ?? (typeof fallback.posts === 'string' ? parseCount(fallback.posts) : fallback.posts ?? null),
    bio: data?.bio || null,
    isVerified: data?.isVerified ?? false,
    isPrivate: data?.isPrivate ?? false,
    profilePicUrl: data?.profilePicUrl || null,
  };
  return [merged];
}

module.exports = { scrapeProfile };
