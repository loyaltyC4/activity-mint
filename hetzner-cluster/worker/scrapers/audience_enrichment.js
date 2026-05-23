/**
 * Audience enrichment scraper.
 *
 * Given a target username + sample size, fetches a small slice of the
 * target's followers AND enriches each with profile-level signal (bio,
 * follower count, city/location signal extracted from bio, hashtags
 * the follower mentions in their own bio).
 *
 * Used by:
 *   - Audience Interest panel        (aggregate bio hashtags)
 *   - Geographic Spread map          (aggregate city signals)
 *   - Outreach Ideas                 (filter candidates by follower-count)
 *
 * Single-worker latency note: each follower bio is one navigation, so a
 * sample of 20 followers ~= 20 nav cycles. The proxy can fan-out by calling
 * audience_enrichment several times with different offsets across multiple
 * workers via the batch endpoint.
 *
 * payload:
 *   { username, sample? (default 20, max 50), offset? (default 0) }
 *
 * Returns array of:
 *   { username, fullName, bio, followerCount, followingCount, postCount,
 *     isVerified, isPrivate, profilePicUrl,
 *     bioHashtags, bioMentions, citySignal,    // derived
 *   }
 */

'use strict';

const { humanDelay, isBlockedSignal, sleep } = require('./utils');

const IG_BASE = 'https://www.instagram.com';

// Common city hints we look for in bios; not exhaustive but useful at scale.
// Each entry: [matcher_regex, normalized_name].
const CITY_HINTS = [
  [/\b(nyc|new york|brooklyn|manhattan)\b/i, 'New York'],
  [/\b(los angeles|la,|l\.a\.|hollywood)\b/i, 'Los Angeles'],
  [/\b(san francisco|sf|bay area)\b/i, 'San Francisco'],
  [/\b(london|uk)\b/i, 'London'],
  [/\b(paris|france)\b/i, 'Paris'],
  [/\b(berlin)\b/i, 'Berlin'],
  [/\b(tokyo|japan)\b/i, 'Tokyo'],
  [/\b(sydney|australia)\b/i, 'Sydney'],
  [/\b(toronto|canada)\b/i, 'Toronto'],
  [/\b(dubai|uae)\b/i, 'Dubai'],
  [/\b(mumbai|delhi|bengaluru|bangalore|india)\b/i, 'India'],
  [/\b(rio|sao paulo|brazil)\b/i, 'Brazil'],
  [/\b(mexico city|mexico)\b/i, 'Mexico City'],
  [/\b(lagos|nigeria)\b/i, 'Lagos'],
  [/\b(berlin|germany)\b/i, 'Germany'],
  [/\b(amsterdam|netherlands)\b/i, 'Amsterdam'],
  [/\b(madrid|barcelona|spain)\b/i, 'Spain'],
  [/\b(istanbul|turkey)\b/i, 'Istanbul'],
  [/\b(singapore)\b/i, 'Singapore'],
  [/\b(seoul|korea)\b/i, 'Seoul'],
];

function detectCity(bio) {
  if (!bio) return null;
  for (const [re, name] of CITY_HINTS) if (re.test(bio)) return name;
  // Flag-emoji hint: try to find any flag emoji and report it without geocoding
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

function decodeStr(v) {
  if (v == null) return null;
  return v.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
}

/**
 * Pull a sample of followers' usernames from the target's followers modal.
 * We re-use the existing followers scraping path (open modal + scroll) but
 * cap the harvest at `sample + offset` items and slice to the requested
 * window. We import the helper lazily to avoid a circular-ish dependency.
 */
async function harvestFollowerUsernames(page, target, sample, offset, log) {
  const { scrapeFollowers } = require('./followers');
  const want = offset + sample;
  const rows = await scrapeFollowers(page, { username: target, limit: want }, log);
  return rows.slice(offset, offset + sample).map((r) => r.username).filter(Boolean);
}

/**
 * Lightweight per-follower bio fetch using meta tags + inline JSON. Returns
 * the enriched record with derived fields filled in.
 */
async function fetchFollowerBio(page, follower, log) {
  const url = `${IG_BASE}/${encodeURIComponent(follower)}/`;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await humanDelay(300, 700);
    const status = resp ? resp.status() : 0;
    if (status === 404) return null;
    const html = await page.content();

    const blobRe = new RegExp(`"username"\\s*:\\s*"${follower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]{0,4000}`, 'i');
    const m = html.match(blobRe);
    let pick = () => null;
    let blob = '';
    if (m) {
      blob = m[0];
      pick = (re) => { const x = blob.match(re); return x ? x[1] : null; };
    }
    const fullName = decodeStr(pick(/"full_name"\s*:\s*"((?:[^"\\]|\\.)*)"/));
    const bio = decodeStr(pick(/"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/));
    const profilePicUrl = decodeStr(pick(/"profile_pic_url(?:_hd)?"\s*:\s*"((?:[^"\\]|\\.)*)"/));
    const isPrivate = pick(/"is_private"\s*:\s*(true|false)/) === 'true';
    const isVerified = pick(/"is_verified"\s*:\s*(true|false)/) === 'true';
    const followerCount = parseInt(pick(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || '0', 10) || null;
    const followingCount = parseInt(pick(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || '0', 10) || null;
    const postCount = parseInt(pick(/"edge_owner_to_timeline_media"\s*:\s*\{\s*"count"\s*:\s*(\d+)/) || '0', 10) || null;

    return {
      username: follower,
      fullName,
      bio,
      followerCount,
      followingCount,
      postCount,
      isVerified,
      isPrivate,
      profilePicUrl,
      bioHashtags: extractHashtags(bio),
      bioMentions: extractMentions(bio),
      citySignal: detectCity(bio),
    };
  } catch (err) {
    log.warn(`enrich ${follower} failed: ${err.message}`);
    return null;
  }
}

async function enrichAudience(page, payload, log) {
  const target = (payload?.username || '').trim().replace(/^@/, '');
  if (!target) throw new Error('payload.username is required');
  const sample = Math.max(1, Math.min(parseInt(payload?.sample ?? 20, 10) || 20, 50));
  const offset = Math.max(0, parseInt(payload?.offset ?? 0, 10) || 0);

  log.info(`enrich audience -> ${target} sample=${sample} offset=${offset}`);

  // Step 1: harvest follower usernames from the target
  let followers = [];
  try {
    followers = await harvestFollowerUsernames(page, target, sample, offset, log);
  } catch (err) {
    log.warn(`follower harvest failed: ${err.message}`);
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

  // Step 2: enrich each follower with their bio. Sequential per worker
  // (the orchestrator can fan multiple slices across workers). Tight delay
  // budget so a sample of 20 finishes in well under 60s.
  const out = [];
  for (const f of followers) {
    const rec = await fetchFollowerBio(page, f, log);
    if (rec) out.push(rec);
    await humanDelay(150, 400);  // micro-jitter between fetches
  }
  log.info(`enriched ${out.length}/${followers.length} followers for ${target}`);
  return out;
}

module.exports = { enrichAudience };
