/**
 * Activity Mint — Tier Definitions & Access Control
 *
 * Three user tiers:
 *   guest      — not logged in, can use public tools and see preview data
 *   free       — logged in but no subscription, limited dashboard access
 *   subscribed — paid plan (standard or premium), full access
 *
 * Each feature has a minimum tier. Components use `canAccess(tier, feature)`
 * to decide whether to render content or show the AccessGate.
 */

export const TIERS = {
  guest: { level: 0, label: 'Guest', color: 'slate' },
  free: { level: 1, label: 'Free', color: 'indigo' },
  standard: { level: 2, label: 'Standard', color: 'emerald' },
  premium: { level: 3, label: 'Premium', color: 'purple' },
};

/**
 * Feature permission map — value is the minimum tier level required.
 * 0 = guest (everyone), 1 = free (logged in), 2 = standard, 3 = premium
 */
export const FEATURES = {
  // ─── Public tools (guest / level 0) ──────────────────────────────
  'tool.story-viewer':       0,
  'tool.post-viewer':        0,
  'tool.hashtag-generator':  0,
  'tool.shadowban-checker':  0,
  'tool.threads-downloader': 0,
  'tool.celebrities':        0,
  'search.preview':          0,

  // ─── Free tier (logged in / level 1) ─────────────────────────────
  'dashboard.view':          1,
  'dashboard.add-account':   1,
  'tool.recent-follower':    1,
  'tool.unfollower':         1,
  'tool.follower-export':    1,
  'tool.comments':           1,
  'tool.facebook':           1,
  'tool.tiktok':             1,
  'tool.linkedin':           1,
  'tool.youtube':            1,
  'report.activity':         1, // limited preview
  'report.ties':             1, // limited preview

  // ─── Standard tier (level 2) ─────────────────────────────────────
  'tool.highlights-viewer':  2,
  'tool.links-viewer':       2,
  'tool.reposts-viewer':     2,
  'tool.like-viewer':        2,
  'report.activity.full':    2,
  'report.ties.full':        2,
  'report.stories.full':     2,
  'page.activity-tracker':   2,
  'page.follower-growth':    2,
  'insights.basic':          2,
  'export.csv':              2,

  // ─── Premium tier (level 3) ──────────────────────────────────────
  'report.ai-insights':      3,
  'page.ai-sentiment':       3,
  'page.competitor-analysis': 3,
  'insights.advanced':       3,
  'insights.mbti':           3,
  'insights.relationship':   3,
  'insights.financial':      3,
  'insights.location':       3,
  'export.pdf':              3,
  'alerts.realtime':         3,
  'suspects.discovery':      3,
};

/**
 * Determine the user's tier from auth + subscription state.
 * @param {object|null} user — Supabase auth user (null = guest)
 * @param {string|null} subscriptionPlan — 'standard' | 'premium' | null
 * @returns {'guest'|'free'|'standard'|'premium'}
 */
export function getUserTier(user, subscriptionPlan) {
  if (!user) return 'guest';
  if (subscriptionPlan === 'premium') return 'premium';
  if (subscriptionPlan === 'standard') return 'standard';
  return 'free';
}

/**
 * Check if a tier can access a feature.
 * @param {'guest'|'free'|'standard'|'premium'} tier
 * @param {string} feature — key from FEATURES map
 * @returns {boolean}
 */
export function canAccess(tier, feature) {
  const required = FEATURES[feature];
  if (required === undefined) return true; // unknown features default to allowed
  return TIERS[tier].level >= required;
}

/**
 * Get the minimum tier needed for a feature (for upgrade CTAs).
 * @param {string} feature
 * @returns {'guest'|'free'|'standard'|'premium'|null}
 */
export function requiredTierFor(feature) {
  const level = FEATURES[feature];
  if (level === undefined) return null;
  const entry = Object.entries(TIERS).find(([, v]) => v.level === level);
  return entry ? entry[0] : null;
}

/**
 * Get the upgrade target tier for a user who can't access a feature.
 * Returns the minimum tier that would grant access.
 */
export function upgradeTierFor(currentTier, feature) {
  const requiredLevel = FEATURES[feature];
  if (requiredLevel === undefined) return null;
  const currentLevel = TIERS[currentTier]?.level ?? 0;
  if (currentLevel >= requiredLevel) return null; // already has access
  const entry = Object.entries(TIERS).find(([, v]) => v.level === requiredLevel);
  return entry ? entry[0] : null;
}

/**
 * Pricing constants for upgrade CTAs
 */
export const PRICING = {
  standard: { monthly: 9.99, label: 'Standard' },
  premium: { monthly: 19.99, label: 'Premium' },
};
