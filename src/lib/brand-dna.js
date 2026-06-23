// ESM module — use import { extractBrandDNA } from ./brand-dna.js
/**
 * brand-dna.js — Brand DNA extraction orchestrator
 *
 * Replaces SociaVault entirely with the existing Hetzner cluster scrapers
 * via /api/apify-proxy. Claude does the interpretation layer.
 *
 * Pipeline:
 *   Layer 1 — Data fetch (parallel): profile + posts + comments + audience_enrichment
 *   Layer 2 — Visual identity: from OpenBrand or default palette
 *   Layer 3 — Copy tone: Claude analyzes captions → voice object
 *   Layer 4 — Performance patterns: top 20% by ER → topFormats, bestPostingHour
 *   Layer 5 — Hook extraction: Claude on top-performer captions
 *   Layer 6 — Audience pain points: Claude on comments from top 3 posts
 *
 * Returns a BrandDNA object ready to be upserted into the brand_dna table
 * and injected into the carousel system prompt.
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SCRAPER_URL   = process.env.SCRAPER_SERVICE_URL   // Hetzner orchestrator URL
const SCRAPER_SECRET = process.env.SCRAPER_SECRET

// ─── Hetzner cluster calls ────────────────────────────────────────────────────

async function clusterFetch(action, payload) {
  const res = await fetch(`${SCRAPER_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {}),
    },
    body: JSON.stringify({ action, payload }),
  })
  if (!res.ok) throw new Error(`cluster ${action} → HTTP ${res.status}`)
  const body = await res.json()
  if (!body.ok) throw new Error(`cluster ${action} error: ${body.error}`)
  return body.items
}

// ─── Claude helpers ───────────────────────────────────────────────────────────

async function claudeJSON(systemPrompt, userContent, maxTokens = 600) {
  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: maxTokens,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userContent }],
  })
  const text = response.content.find(b => b.type === 'text')?.text || ''
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Claude returned no JSON block')
  return JSON.parse(jsonMatch[0])
}

// ─── Layer helpers ────────────────────────────────────────────────────────────

function calcEngagementRate(post, followerCount) {
  if (!followerCount || followerCount === 0) return 0
  return ((post.likes || 0) + (post.comments || 0)) / followerCount
}

function topPercentPosts(posts, followerCount, pct = 0.2) {
  const scored = posts.map(p => ({
    ...p,
    _er: calcEngagementRate(p, followerCount),
  }))
  scored.sort((a, b) => b._er - a._er)
  return scored.slice(0, Math.max(1, Math.floor(scored.length * pct)))
}

function mostCommon(arr) {
  const counts = {}
  for (const v of arr) counts[v] = (counts[v] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

function extractHour(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  return isNaN(d.getTime()) ? null : d.getUTCHours()
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Extract brand DNA for a given Instagram handle.
 *
 * @param {{
 *   handle:       string
 *   niche:        string
 *   goal:         string
 *   customerDesc?: string
 *   websiteUrl?:  string
 * }} input
 * @returns {Promise<BrandDNA>}
 */
async function extractBrandDNA(input) {
  const { niche, goal, customerDesc } = input
  const cleanHandle = (input.handle || '').replace(/^@/, '').trim()

  // ── Layer 1: Parallel data fetch (skipped gracefully when no handle) ──────
  let profileItems = [], postItems = [], audienceItems = []
  if (cleanHandle) {
    ;[profileItems, postItems, audienceItems] = await Promise.all([
      clusterFetch('profile', { username: cleanHandle }).catch(() => []),
      clusterFetch('posts',   { username: cleanHandle, limit: 30 }).catch(() => []),
      clusterFetch('audience_enrichment', { username: cleanHandle, sample: 20 }).catch(() => []),
    ])
  }

  const profile  = profileItems?.[0] || {}
  const posts    = postItems || []
  const followerCount = profile.followers || profile.followerCount || 0

  // Fetch comments from the top 3 posts (best-effort, don't fail if blocked)
  const topPosts = topPercentPosts(posts, followerCount, 0.1).slice(0, 3)
  const commentBatches = await Promise.all(
    topPosts.map(p =>
      clusterFetch('comments', { postUrl: p.url || `https://www.instagram.com/p/${p.shortcode}/`, limit: 30 })
        .then(items => items.map(c => c.text || c.comment || '').filter(Boolean))
        .catch(() => [])
    )
  )
  const allComments = commentBatches.flat().slice(0, 90)

  // ── Layer 2: Visual identity ─────────────────────────────────────────────
  // Use OpenBrand if websiteUrl provided — fallback to Activity Mint defaults
  let primaryColor   = '#1a1a2e'
  let secondaryColor = '#16213e'
  let accentColor    = '#e94560'
  let backgroundColor = '#ffffff'
  let surfaceColor   = '#f5f5f5'
  let headingFont    = 'Inter'
  let bodyFont       = 'Inter'
  let logoUrl        = profile.profilePicUrlHD || profile.profilePicUrl || null
  const styleKeywords = []
  let brandNameFromSite = null

  if (input.websiteUrl) {
    try {
      const { extractBrandFromUrl } = await import('./openbrand.js')
      const brand = await extractBrandFromUrl(input.websiteUrl)
      if (brand.colors?.[0]) primaryColor   = brand.colors[0]
      if (brand.colors?.[1]) secondaryColor = brand.colors[1]
      if (brand.colors?.[2]) accentColor    = brand.colors[2]
      if (brand.fonts?.[0])  headingFont    = brand.fonts[0]
      if (brand.fonts?.[1])  bodyFont       = brand.fonts[1]
      if (brand.logo)        logoUrl        = brand.logo
      if (brand.name)        brandNameFromSite = brand.name
    } catch {
      // OpenBrand failed — defaults remain
    }
  }

  // ── Layer 3: Copy tone ───────────────────────────────────────────────────
  const captionSample = posts
    .filter(p => p.caption)
    .slice(0, 20)
    .map(p => p.caption)
    .join('\n---\n')

  let voice = {
    tone: 'conversational, authentic',
    formality: 3,
    energy: 'medium',
    personality: ['professional', 'helpful', 'clear'],
    emojiDensity: 'light',
    avgCaptionLength: 150,
  }

  if (captionSample.length > 50) {
    try {
      voice = await claudeJSON(
        'You are a brand voice analyst. Analyze captions and return ONLY a JSON object — no markdown, no explanation.',
        `Analyze the brand voice in these Instagram captions:\n\n${captionSample.slice(0, 4000)}\n\nReturn exactly:\n{"tone":"string","formality":1-5,"energy":"low|medium|high","personality":["adj1","adj2","adj3"],"emojiDensity":"none|light|heavy","avgCaptionLength":number}`,
        400,
      )
    } catch {
      // Keep defaults
    }
  }

  // ── Layer 4: Performance patterns ───────────────────────────────────────
  const topPerformers = topPercentPosts(posts, followerCount)
  const topFormats = mostCommon(topPerformers.map(p => p.type || p.format || 'image'))
  const postingHours = topPerformers.map(p => extractHour(p.timestamp || p.postedAt)).filter(h => h !== null)
  const bestPostingHour = postingHours.length > 0
    ? Number(mostCommon(postingHours.map(String))[0])
    : 18

  // ── Layer 5: Top hooks ────────────────────────────────────────────────────
  const topCaptions = topPerformers
    .filter(p => p.caption)
    .slice(0, 10)
    .map(p => p.caption)
    .join('\n---\n')

  let topHooks = [
    `Here's what most ${niche} creators get wrong…`,
    `The ${niche} tip nobody talks about`,
    `I wish someone told me this about ${niche}`,
  ]

  if (topCaptions.length > 50) {
    try {
      const result = await claudeJSON(
        'You are a hook analyst. Return ONLY a JSON array — no markdown, no explanation.',
        `Extract the 3 most effective hook formulas from these top-performing Instagram captions:\n\n${topCaptions.slice(0, 3000)}\n\nReturn exactly: ["hook formula 1","hook formula 2","hook formula 3"]`,
        300,
      )
      if (Array.isArray(result) && result.length >= 1) {
        topHooks = result.slice(0, 3)
      }
    } catch {
      // Keep defaults
    }
  }

  // ── Layer 6: Audience pain points ────────────────────────────────────────
  let audiencePains = [
    `Struggling to grow their ${niche} presence`,
    `Unsure what content resonates with their audience`,
    `Not seeing results despite consistent posting`,
  ]

  if (allComments.length >= 5) {
    try {
      const commentSample = allComments.slice(0, 50).join('\n')
      const result = await claudeJSON(
        'You are an audience researcher. Return ONLY a JSON array — no markdown, no explanation.',
        `Extract the 3 most common audience desires, complaints, or questions from these Instagram comments:\n\n${commentSample.slice(0, 3000)}\n\nReturn exactly: ["pain point 1","pain point 2","pain point 3"]`,
        300,
      )
      if (Array.isArray(result) && result.length >= 1) {
        audiencePains = result.slice(0, 3)
      }
    } catch {
      // Keep defaults
    }
  }

  // ── Assemble BrandDNA ─────────────────────────────────────────────────────
  return {
    handle:           cleanHandle,
    niche,
    goal,
    customerDesc:     customerDesc || null,
    brandName:        profile.fullName || brandNameFromSite || cleanHandle || 'Your brand',

    // Visual (maps to open-carrusel BrandConfig)
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    surfaceColor,
    headingFont,
    bodyFont,
    logoUrl,
    styleKeywords,

    // Voice
    voice: {
      tone:             voice.tone            || 'conversational, authentic',
      formality:        voice.formality       || 3,
      energy:           voice.energy          || 'medium',
      personality:      voice.personality     || ['professional', 'helpful', 'clear'],
      emojiDensity:     voice.emojiDensity    || 'light',
      avgCaptionLength: voice.avgCaptionLength || 150,
    },

    // Performance
    topHooks,
    audiencePains,
    topFormats: topFormats.slice(0, 3),
    bestPostingHour,

    extractedAt: new Date().toISOString(),
  }
}

export { extractBrandDNA }
