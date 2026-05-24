/**
 * Single source of truth for follower / following set math + filtering,
 * inspired by davidarroyo1234/InstagramUnfollowers (MIT) - the canonical
 * open-source reference for unfollower analytics.
 *
 * Two distinct concepts that Activity Mint historically conflated:
 *
 *   1. NON-FOLLOWERS  - you (the tracked handle) follow them, they don't
 *                       follow you back. Pure set logic on a single snapshot.
 *                       This is the reference repo's primary feature.
 *
 *   2. RECENT UNFOLLOWERS - were in your followers list previously, gone now.
 *                       Requires comparing snapshots over time. Ship 2 builds
 *                       this; this file only covers (1) and filtering.
 *
 * Every Activity Mint surface that mentions unfollowers / non-followers /
 * fans / mutuals should import from this module so the counts agree
 * everywhere.
 */

'use strict'

/* ─── Storage keys ─────────────────────────────────────────────────────── */
export const WHITELIST_STORAGE_KEY = 'iu_whitelist_v1'

/* ─── Default-avatar URL fragments (from davidarroyo1234/InstagramUnfollowers) ──
 * Instagram serves the same default avatar image to accounts that never
 * uploaded a profile picture. These URLs contain stable id fragments we
 * can match on. Accounts using the default avatar are very often bots or
 * abandoned accounts.
 */
export const DEFAULT_AVATAR_FRAGMENTS = [
  '44884218_345707102882519_2446069589734326272_n',
  '464760996_1254146839119862_3605321457742435801_n',
]

/* ─── Normalize a raw follower record from any source ───────────────────
 * Our cluster scrapers return { username, fullName, profilePicUrl,
 * isVerified, isPrivate }. Apify and legacy scrapers use other casing
 * conventions. Coerce them all to a canonical shape with no surprises.
 */
export function normalizeFollower(raw) {
  if (!raw) return null
  const username = raw.username || raw.handle || raw.login || raw.user_name || raw.userName || raw.owner_username || ''
  if (!username) return null
  return {
    username: String(username).trim(),
    fullName: raw.fullName || raw.full_name || raw.name || raw.displayName || '',
    profilePicUrl: raw.profilePicUrl || raw.profile_pic_url || raw.profilePicture || raw.avatar || '',
    isVerified: !!(raw.isVerified || raw.is_verified),
    isPrivate: !!(raw.isPrivate || raw.is_private),
  }
}

/** Deduplicate a list of users by lowercased username. Stable order. */
export function dedupByUsername(list) {
  const seen = new Set()
  const out = []
  for (const u of (list || [])) {
    if (!u || !u.username) continue
    const k = u.username.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(u)
  }
  return out
}

/** Default-avatar detection: matches the reference repo's fragment list. */
export function isWithoutProfilePicture(user) {
  const url = (user && user.profilePicUrl) || ''
  if (!url) return true  // missing entirely = treat as no-pic
  return DEFAULT_AVATAR_FRAGMENTS.some((f) => url.includes(f))
}

/* ─── Canonical category computation ────────────────────────────────────
 * Given two lists (followers of the tracked handle, accounts the handle
 * follows) return three set-derived buckets:
 *
 *   mutuals       = followers ∩ following  (both directions of follow)
 *   nonFollowers  = following \ followers  (you follow, they don't follow back)
 *   fans          = followers \ following  (they follow you, you don't follow back)
 *
 * Sanity properties:
 *   mutuals.length + nonFollowers.length === following.length
 *   mutuals.length + fans.length         === followers.length
 */
export function computeCategories(rawFollowers, rawFollowing) {
  const followers = dedupByUsername((rawFollowers || []).map(normalizeFollower).filter(Boolean))
  const following = dedupByUsername((rawFollowing || []).map(normalizeFollower).filter(Boolean))

  const followerSet = new Set(followers.map((f) => f.username.toLowerCase()))
  const followingSet = new Set(following.map((f) => f.username.toLowerCase()))

  const mutuals = followers.filter((f) => followingSet.has(f.username.toLowerCase()))
  const nonFollowers = following.filter((f) => !followerSet.has(f.username.toLowerCase()))
  const fans = followers.filter((f) => !followingSet.has(f.username.toLowerCase()))

  return {
    followers,        // normalized + deduped, full list
    following,        // normalized + deduped, full list
    mutuals,
    nonFollowers,
    fans,
    counts: {
      followers:    followers.length,
      following:    following.length,
      mutuals:      mutuals.length,
      nonFollowers: nonFollowers.length,
      fans:         fans.length,
    },
  }
}

/* ─── Filtering ─────────────────────────────────────────────────────────
 * Apply quality filters + search + whitelist exclusion to a list. All
 * five flags default to "include" so the function is opt-out: passing an
 * empty filters object returns the input untouched (post-normalization).
 *
 * Filters mirror the reference tool's ScanningFilter, plus search +
 * whitelist for usability.
 */
export const DEFAULT_FILTERS = Object.freeze({
  showVerified: true,         // include blue-check accounts
  showPrivate: true,          // include private accounts
  showWithoutProfilePicture: true, // include default-avatar accounts (likely bots)
  search: '',                 // case-insensitive substring match on username + fullName
  whitelist: [],              // array of lowercase usernames to exclude entirely
})

export function applyFilters(users, filters = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters }
  const whitelist = new Set((f.whitelist || []).map((u) => String(u).toLowerCase()))
  const search = (f.search || '').trim().toLowerCase()

  return (users || []).filter((u) => {
    if (!u || !u.username) return false
    if (whitelist.has(u.username.toLowerCase())) return false
    if (!f.showVerified && u.isVerified) return false
    if (!f.showPrivate && u.isPrivate) return false
    if (!f.showWithoutProfilePicture && isWithoutProfilePicture(u)) return false
    if (search) {
      const inUsername = u.username.toLowerCase().includes(search)
      const inFullName = (u.fullName || '').toLowerCase().includes(search)
      if (!inUsername && !inFullName) return false
    }
    return true
  })
}

/* ─── Whitelist persistence (localStorage) ──────────────────────────────
 * Lightweight - just an array of lowercased usernames. Per-browser, no
 * server sync. Match the reference repo's UX of "click avatar to toggle
 * whitelist for this account."
 */
export function loadWhitelist() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(WHITELIST_STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map((u) => String(u).toLowerCase()) : []
  } catch {
    return []
  }
}

export function saveWhitelist(usernames) {
  if (typeof localStorage === 'undefined') return
  const clean = (Array.isArray(usernames) ? usernames : []).map((u) => String(u).toLowerCase())
  try { localStorage.setItem(WHITELIST_STORAGE_KEY, JSON.stringify(clean)) } catch {}
}

export function toggleWhitelist(username) {
  const u = String(username || '').toLowerCase()
  if (!u) return loadWhitelist()
  const current = loadWhitelist()
  const next = current.includes(u)
    ? current.filter((x) => x !== u)
    : [...current, u]
  saveWhitelist(next)
  return next
}

/* ─── Export helpers ────────────────────────────────────────────────────
 * Reference tool offers JSON + CSV export of any visible list. Useful for
 * the Follower Export tool and for downloading a "don't follow back"
 * list for a one-time bulk-unfollow elsewhere.
 */
export function buildCsvBlob(users) {
  const headers = ['username', 'full_name', 'is_verified', 'is_private', 'profile_pic_url']
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const rows = (users || []).map((u) => [
    u.username, u.fullName, u.isVerified, u.isPrivate, u.profilePicUrl,
  ].map(escape).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  return new Blob([csv], { type: 'text/csv;charset=utf-8' })
}

export function downloadCsv(users, filename = 'instagram-users.csv') {
  if (typeof window === 'undefined') return
  const blob = buildCsvBlob(users)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function copyUsernamesToClipboard(users) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false
  const text = (users || []).map((u) => u.username).sort().join('\n')
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
