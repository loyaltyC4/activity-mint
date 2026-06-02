/**
 * api/carousel/[id]/slides.js — Vercel Serverless Function
 *
 * GET  /api/carousel/:id/slides      — list all slides ordered by slide_order
 * POST /api/carousel/:id/slides      — create a slide (called by Claude tool_use handler)
 * PUT  /api/carousel/:id/slides      — reorder slides (body: { slideIds: string[] })
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const MAX_SLIDES = 20

async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return error ? null : user
}

async function getCarousel(carouselId, userId) {
  const { data, error } = await supabase
    .from('carousels')
    .select('id, user_id, aspect_ratio')
    .eq('id', carouselId)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data
}

function extractHeadline(html) {
  // Pull the first heading or large-text element from the HTML for filmstrip display
  const headingMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (headingMatch) return headingMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
  // Fall back to first element text content if no heading
  const anyText = html.match(/>([^<]{4,80})<\//)
  return anyText ? anyText[1].trim().slice(0, 80) : ''
}

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { id: carouselId } = req.query
  if (!carouselId) return res.status(400).json({ error: 'carouselId is required' })

  // ── GET: list slides ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const carousel = await getCarousel(carouselId, user.id)
    if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

    const { data, error } = await supabase
      .from('slides')
      .select('id, html, previous_versions, slide_order, notes, headline, created_at')
      .eq('carousel_id', carouselId)
      .order('slide_order', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ slides: data })
  }

  // ── POST: create slide ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const carousel = await getCarousel(carouselId, user.id)
    if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

    const { html, notes = '' } = req.body || {}
    if (!html || typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ error: 'html is required' })
    }

    // Get current slide count to enforce cap
    const { count } = await supabase
      .from('slides')
      .select('id', { count: 'exact', head: true })
      .eq('carousel_id', carouselId)

    if ((count || 0) >= MAX_SLIDES) {
      return res.status(422).json({ error: `Carousel already has ${MAX_SLIDES} slides (maximum)` })
    }

    const headline = extractHeadline(html)

    const { data, error } = await supabase
      .from('slides')
      .insert({
        carousel_id:  carouselId,
        html:         html.trim(),
        slide_order:  count || 0,
        notes:        notes || '',
        headline,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Bump carousel updated_at
    await supabase
      .from('carousels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', carouselId)

    return res.status(201).json(data)
  }

  // ── PUT: reorder slides ───────────────────────────────────────────────
  if (req.method === 'PUT') {
    const carousel = await getCarousel(carouselId, user.id)
    if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

    const { slideIds } = req.body || {}
    if (!Array.isArray(slideIds) || slideIds.length === 0) {
      return res.status(400).json({ error: 'slideIds array is required' })
    }

    // Update each slide's order in parallel
    await Promise.all(
      slideIds.map((slideId, order) =>
        supabase
          .from('slides')
          .update({ slide_order: order })
          .eq('id', slideId)
          .eq('carousel_id', carouselId)
      )
    )

    await supabase
      .from('carousels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', carouselId)

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
