/**
 * Context Digest — compressed token-efficient profile summary for AI calls.
 *
 * Instead of sending 2000+ tokens of raw analysis on every AI call,
 * we build a ~300-token digest ONCE per handle per session and reuse it.
 *
 * Token math (Claude Haiku pricing $0.25/M input + $1.25/M output):
 *   digest: ~300 tokens input
 *   request specifics: ~100 tokens
 *   system prompt: ~400 tokens
 *   TOTAL INPUT: ~800 tokens
 *   OUTPUT: ~500 tokens
 *   COST: $0.000825/call
 *   5 AI buttons in one session: $0.004 total
 *
 * Without digest (raw payloads): ~2500 tokens input × 5 calls = $0.03
 * SAVINGS: 87% fewer input tokens.
 */

const DIGEST_CACHE_KEY = (h) => `am:digest:v1:${h}`
const DIGEST_TTL = 4 * 60 * 60 * 1000 // 4 hours

/**
 * Build a compressed profile digest from available analysis data.
 * Returns a single string < 300 tokens.
 */
export function buildDigest({ profile, analysis, deconstruction } = {}) {
  const parts = []

  // Profile basics (~50 tokens)
  if (profile) {
    const f = profile.followersCount || profile.followers || 0
    const tier = f >= 1_000_000 ? 'mega' : f >= 100_000 ? 'macro' : f >= 10_000 ? 'micro' : 'nano'
    parts.push(`@${profile.username || '?'} | ${f.toLocaleString()} followers (${tier}) | ${profile.postsCount || profile.posts || '?'} posts | following: ${profile.followingCount || profile.following || '?'}`)
    if (profile.biography) parts.push(`Bio: ${profile.biography.slice(0, 100)}`)
  }

  // Script Studio analysis (~100 tokens)
  if (analysis?.ok) {
    parts.push(`Analyzed ${analysis.posts_count || '?'} posts: ${analysis.buckets?.winners_n || 0}W/${analysis.buckets?.losers_n || 0}L`)
    if (analysis.lexicon?.winners?.length) {
      parts.push(`High-traction: ${analysis.lexicon.winners.slice(0, 4).map(w => `"${w.phrase}"`).join(', ')}`)
    }
    if (analysis.lexicon?.losers?.length) {
      parts.push(`Dead phrases: ${analysis.lexicon.losers.slice(0, 3).map(l => `"${l.phrase}"`).join(', ')}`)
    }
    if (analysis.blueprint) {
      const bp = analysis.blueprint
      parts.push(`Blueprint: opener=${bp.common_opener?.label || '?'} (${Math.round((bp.common_opener?.share || 0) * 100)}%), ending=${bp.common_ending?.id || '?'}, avg=${bp.avg_length || '?'}chars, bullets=${Math.round((bp.uses_bullets_share || 0) * 100)}%`)
    }
  }

  // Deconstruction patterns (~80 tokens)
  if (deconstruction?.ok) {
    const p = deconstruction.patterns || {}
    if (p.format_distribution) {
      parts.push(`Formats: ${Object.entries(p.format_distribution).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
    if (p.hook_distribution) {
      parts.push(`Hooks: ${Object.entries(p.hook_distribution).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
    parts.push(`AvgER: ${(p.avg_engagement_rate || 0).toFixed(3)}% | mixed-media: ${Math.round((p.mixed_media_usage || 0) * 100)}% | swipeCTA: ${Math.round((p.swipe_cta_usage || 0) * 100)}%`)
    if (deconstruction.opportunities?.length) {
      parts.push(`Opps: ${deconstruction.opportunities.slice(0, 2).map(o => o.text.slice(0, 80)).join('; ')}`)
    }
  }

  return parts.join('\n')
}

/**
 * Load cached digest for a handle.
 */
export function loadDigest(handle) {
  if (!handle || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DIGEST_CACHE_KEY(handle))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || (Date.now() - (d.t || 0)) > DIGEST_TTL) return null
    return d.digest
  } catch { return null }
}

/**
 * Save digest to cache.
 */
export function saveDigest(handle, digest) {
  if (!handle || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DIGEST_CACHE_KEY(handle), JSON.stringify({ t: Date.now(), digest }))
  } catch {}
}

/**
 * Get-or-build: returns cached digest if fresh, builds + caches if not.
 */
export function getOrBuildDigest(handle, data = {}) {
  const cached = loadDigest(handle)
  if (cached) return cached
  const digest = buildDigest(data)
  if (digest) saveDigest(handle, digest)
  return digest
}

/**
 * Cache an AI response keyed by (handle, request_type, digest_hash).
 * Returns cached response if available.
 */
const AI_CACHE_KEY = (h, rt) => `am:ai:v1:${h}:${rt}`

export function cacheAIResponse(handle, requestType, response) {
  if (!handle || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AI_CACHE_KEY(handle, requestType), JSON.stringify({ t: Date.now(), response }))
  } catch {}
}

export function loadCachedAIResponse(handle, requestType) {
  if (!handle || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AI_CACHE_KEY(handle, requestType))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || (Date.now() - (d.t || 0)) > DIGEST_TTL) return null
    return d.response
  } catch { return null }
}
