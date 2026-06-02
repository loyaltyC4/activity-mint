/**
 * api/carousel/[id]/slides/[slideId].js — Vercel Serverless Function
 *
 * PUT    /api/carousel/:id/slides/:slideId   — update slide HTML (saves version history)
 * DELETE /api/carousel/:id/slides/:slideId   — delete slide, re-order remaining
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const MAX_VERSIONS = 5

async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return error ? null : user
}

function extractHeadline(html) {
  const headingMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (headingMatch) return headingMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
  const anyText = html.match(/>([^<]{4,80})<\//)
  return anyText ? anyText[1].trim().slice(0, 80) : ''
}

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { id: carouselId, slideId } = req.query
  if (!carouselId || !slideId) {
    return res.status(400).json({ error: 'carouselId and slideId are required' })
  }

  // Verify user owns the carousel that contains this slide
  const { data: carousel } = await supabase
    .from('carousels')
    .select('id')
    .eq('id', carouselId)
    .eq('user_id', user.id)
    .single()

  if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

  // ── PUT: update slide HTML ──────────────────────────────────────────────
  if (req.method === 'PUT') {
    const { html, notes } = req.body || {}
    if (!html || typeof html !== 'string' || !html.trim()) {
      return res.status(400).json({ error: 'html is required' })
    }

    // Fetch current slide to build version history
    const { data: current } = await supabase
      .from('slides')
      .select('html, previous_versions')
      .eq('id', slideId)
      .eq('carousel_id', carouselId)
      .single()

    if (!current) return res.status(404).json({ error: 'Slide not found' })

    // Append current HTML to version history, cap at MAX_VERSIONS
    const previousVersions = [...(current.previous_versions || [])]
    if (current.html && current.html !== html.trim()) {
      previousVersions.push(current.html)
      if (previousVersions.length > MAX_VERSIONS) previousVersions.shift()
    }

    const updates = {
      html:              html.trim(),
      previous_versions: previousVersions,
      headline:          extractHeadline(html),
    }
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await supabase
      .from('slides')
      .update(updates)
      .eq('id', slideId)
      .eq('carousel_id', carouselId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    await supabase
      .from('carousels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', carouselId)

    return res.status(200).json(data)
  }

  // ── DELETE: remove slide and re-order ─────────────────────────────────
  if (req.method === 'DELETE') {
    const { data: slide } = await supabase
      .from('slides')
      .select('slide_order')
      .eq('id', slideId)
      .eq('carousel_id', carouselId)
      .single()

    if (!slide) return res.status(404).json({ error: 'Slide not found' })

    const { error: deleteError } = await supabase
      .from('slides')
      .delete()
      .eq('id', slideId)

    if (deleteError) return res.status(500).json({ error: deleteError.message })

    // Re-order slides that were after the deleted one
    const { data: remaining } = await supabase
      .from('slides')
      .select('id, slide_order')
      .eq('carousel_id', carouselId)
      .gt('slide_order', slide.slide_order)
      .order('slide_order', { ascending: true })

    if (remaining && remaining.length > 0) {
      await Promise.all(
        remaining.map(s =>
          supabase
            .from('slides')
            .update({ slide_order: s.slide_order - 1 })
            .eq('id', s.id)
        )
      )
    }

    await supabase
      .from('carousels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', carouselId)

    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
