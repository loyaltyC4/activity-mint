/**
 * api/brand-dna.js — Vercel Serverless Function
 *
 * POST /api/brand-dna
 * Body: { handle, niche, goal, customerDesc?, websiteUrl? }
 *
 * Triggers brand DNA extraction from the Hetzner cluster + Claude,
 * upserts the result into Supabase brand_dna table, and returns the
 * complete BrandDNA object.
 *
 * This runs synchronously (not as a queue job) because Vercel Pro has
 * a 60-second function timeout and extraction typically takes 20-35s.
 * If the timeout becomes a problem, move to a BullMQ job + SSE pattern.
 */

import { createClient } from '@supabase/supabase-js'
import { extractBrandDNA } from '../src/lib/brand-dna.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // ── Validate body ─────────────────────────────────────────────────────────
  const { handle, niche, goal, customerDesc, websiteUrl } = req.body || {}

  if (!handle || typeof handle !== 'string') {
    return res.status(400).json({ error: 'handle is required' })
  }
  if (!niche || typeof niche !== 'string') {
    return res.status(400).json({ error: 'niche is required' })
  }
  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ error: 'goal is required' })
  }

  const cleanHandle = handle.replace(/^@/, '').trim().toLowerCase()

  try {
    // ── Extract brand DNA ─────────────────────────────────────────────────
    const brandDNA = await extractBrandDNA({
      handle:      cleanHandle,
      niche,
      goal,
      customerDesc: customerDesc || null,
      websiteUrl:  websiteUrl   || null,
    })

    // ── Upsert to Supabase ────────────────────────────────────────────────
    const { error: upsertError } = await supabase
      .from('brand_dna')
      .upsert({
        user_id:           user.id,
        handle:            cleanHandle,
        brand_name:        brandDNA.brandName,
        primary_color:     brandDNA.primaryColor,
        secondary_color:   brandDNA.secondaryColor,
        accent_color:      brandDNA.accentColor,
        background_color:  brandDNA.backgroundColor,
        surface_color:     brandDNA.surfaceColor,
        heading_font:      brandDNA.headingFont,
        body_font:         brandDNA.bodyFont,
        logo_url:          brandDNA.logoUrl,
        style_keywords:    brandDNA.styleKeywords,
        voice_tone:        brandDNA.voice.tone,
        voice_formality:   brandDNA.voice.formality,
        voice_energy:      brandDNA.voice.energy,
        voice_personality: brandDNA.voice.personality,
        emoji_density:     brandDNA.voice.emojiDensity,
        avg_caption_length:brandDNA.voice.avgCaptionLength,
        top_hooks:         brandDNA.topHooks,
        audience_pains:    brandDNA.audiencePains,
        top_formats:       brandDNA.topFormats,
        best_posting_hour: brandDNA.bestPostingHour,
        niche,
        goal,
        customer_desc:     customerDesc || null,
        extracted_at:      brandDNA.extractedAt,
      }, {
        onConflict: 'user_id,handle',
      })

    if (upsertError) {
      console.error('[brand-dna] supabase upsert error:', upsertError)
      // Return the data anyway — the caller can still use it even if persistence failed
    }

    return res.status(200).json({ ok: true, brandDNA })
  } catch (err) {
    console.error('[brand-dna] extraction failed:', err.message)
    return res.status(500).json({ error: err.message || 'Brand DNA extraction failed' })
  }
}
