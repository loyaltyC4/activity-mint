/**
 * Audience enrichment scraper (v2 - API-based per-follower bio).
 *
 * IG's profile pages are now SPA shells with no inline JSON, so for each
 * sampled follower we call /api/v1/users/web_profile_info/ from inside the
 * logged-in page context (same approach as posts.js).
 *
 * Given a target username + sample size, fetches a small slice of the
 * target's followers AND enriches each with bio, follower/following/post
 * counts, verified/private flags, plus derived signals: city hint extracted
 * from the bio text and any flag emojis, hashtags + mentions the follower
 * uses in their own bio.
 *
 * Used by:
 *   - Audience Interest panel    (aggregate bio hashtags + city hints)
 *   - Geographic Spread map      (aggregate city signals)
 *   - Outreach Ideas             (filter by follower-count + bio keyword)
 *
 * Per-worker latency: a sample of 20 followers ~= 20 sequential API calls
 * inside the same page session. The proxy can fan out by calling this
 * action multiple times with different offsets across workers via batch.
 *
 * payload:
 *   { username, sample? (default 20, max 50), offset? (default 0) }
 */

'use strict';

const { humanDelay, isBlockedSignal, sleep } = require('./utils');

const IG_BASE = 'https://www.instagram.com';
const IG_APP_ID = '936619743392459';

// Common city / region hints we look for in bios. Not exhaustive, but at
// scale this gives us "X% of audience in NYC, Y% in LA" granularity which
// is enough for a marketing dashboard.
const CITY_HINTS = [
  [/\b(nyc|new york|brooklyn|manhattan|queens)\b/i, 'New York'],
  [/\b(los angeles|la,|l\.a\.|hollywood|santa monica)\b/i, 'Los Angeles'],
  [/\b(san francisco|sf|bay area|silicon valley)\b/i, 'San Francisco'],
  [/\b(london|england|uk)\b/i, 'London'],
  [/\b(paris|france)\b/i, 'Paris'],
  [/\b(berlin|germany)\b/i, 'Berlin'],
  [/\b(tokyo|japan)\b/i, 'Tokyo'],
  [/\b(sydney|australia|melbourne)\b/i, 'Sydney'],
  [/\b(toronto|canada|montreal|vancouver)\b/i, 'Toronto'],
  [/\b(dubai|uae|abu dhabi)\b/i, 'Dubai'],
  [/\b(mumbai|delhi|bengaluru|bangalore|india|chennai|kolkata)\b/i, 'India'],
  [/\b(rio|sao paulo|brazil|brasil)\b/i, 'Brazil'],
  [/\b(mexico city|cdmx|mexico|méxico)\b/i, 'Mexico City'],
  [/\b(lagos|nigeria|abuja)\b/i, 'Lagos'],
  [/\b(amsterdam|netherlands)\b/i, 'Amsterdam'],
  [/\b(madrid|barcelona|spain|españa)\b/i, 'Spain'],
  [/\b(istanbul|turkey|türkiye)\b/i, 'Istanbul'],
  [/\b(singapore)\b/i, 'Singapore'],
  [/\b(seoul|korea)\b/i, 'Seoul'],
  [/\b(lagos|accra|nairobi|johannesburg|cape town)\b/i, 'Africa'],
];

function detectCity(bio) {
  if (!bio) return null;
  for (const [re, name] of CITY_HINTS) if (re.test(bio)) return name;
  const flag = bio.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  return flag ? `flag:${flag[0]}` : null;
}

function extractHashtags(text) {
  if (!text) return [];
  const m = text.match(/#[\p{L}\p{N}_]+/gu);
  return m ? [...new Set(m.map((s) => s.slice(1).toLowerCase()))] : [];
}
function extractMentions(text) {
  if (!text) return [];
  const m = text.match(/@[\w.]+/g);
  return m ? [...new Set(m.map((s) => s.slice(1).toLowerCase()))] : [];
}

/** API call from page context. Returns user object or null. */
async function fetchProfileInfo(page, username) {
  const url = `${IG_BASE}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const data = await page.evaluate(async (args) => {
    try {
      const r = await fetch(args.url, {
        headers: {
          'x-ig-app-id': args.appId,
          'accept': 'application/json',
          'sec-fetch-site': 'same-origin',
        },
        credentials: 'include',
      });
      if (!r.ok) return { __err: `http_${r.status}` };
      const j = await r.json();
      return j?.data || j;
    } catch (e) {
      return { __err: e.message || 'fetch_failed' };
    }
  }, { url, appId: IG_APP_ID }).catch(() => null);

  if (!data || data.__err || !data.user) return null;
  return data.user;
}

/**
 * Get a sample of follower usernames by re-using the existing followers
 * scraper. Returns the slice [offset, offset+sample).
 */
async function harvestFollowerUsernames(page, target, sample, offset, log) {
  const { scrapeFollowers } = require('./followers');
  const want = offset + sample;
  const rows = await scrapeFollowers(page, { username: target, limit: want }, log);
  return rows.slice(offset, offset + sample).map((r) => r.username).filter(Boolean);
}

/**
 * Per-follower enrichment via API. Self-contained; one call per follower.
 * The orchestrator's batch endpoint is the right place to parallelize this
 * across workers, not in-worker.
 */
async function enrichOne(page, follower, log) {
  const user = await fetchProfileInfo(page, follower);
  if (!user) return null;
  const bio = user.biography || null;
  return {
    username: user.username || follower,
    fullName: user.full_name || null,
    bio,
    followerCount: user.edge_followed_by?.count ?? null,
    followingCount: user.edge_follow?.count ?? null,
    postCount: user.edge_owner_to_timeline_media?.count ?? null,
    isVerified: !!user.is_verified,
    isPrivate: !!user.is_private,
    profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || null,
    bioHashtags: extractHashtags(bio),
    bioMentions: extractMentions(bio),
    citySignal: detectCity(bio),
    externalUrl: user.external_url || null,
    category: user.category_name || user.business_category_name || null,
  };
}

async function enrichAudience(page, payload, log) {
  const target = (payload?.username || '').trim().replace(/^@/, '');
  if (!target) throw new Error('payload.username is required');
  const sample = Math.max(1, Math.min(parseInt(payload?.sample ?? 20, 10) || 20, 50));
  const offset = Math.max(0, parseInt(payload?.offset ?? 0, 10) || 0);

  log.info(`enrich audience -> ${target} sample=${sample} offset=${offset}`);

  // Need to be on instagram.com so the API call inherits cookies + origin
  await page.goto(`${IG_BASE}/${encodeURIComponent(target)}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await humanDelay(800, 1500);

  let followers;
  try {
    followers = await harvestFollowerUsernames(page, target, sample, offset, log);
  } catch (err) {
    if (err.blocked || isBlockedSignal(err.message)) {
      err.blocked = true;
      throw err;
    }
    throw err;
  }
  if (followers.length === 0) {
    log.info(`no followers harvested for ${target}`);
    return [];
  }

  const out = [];
  for (const f of followers) {
    try {
      const rec = await enrichOne(page, f, log);
      if (rec) out.push(rec);
    } catch (err) {
      log.warn(`enrich ${f} failed: ${err.message}`);
    }
    await humanDelay(120, 380);
  }
  log.info(`enriched ${out.length}/${followers.length} followers for ${target}`);
  return out;
}

module.exports = { enrichAudience };
