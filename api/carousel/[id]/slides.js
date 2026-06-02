/**
 * api/carousel/[id]/slides.js
 * GET  — list slides ordered
 * POST — create slide (from Claude tool_use)
 * PUT  — reorder slides
 */

import { getUserClient } from '../../_supabase.js'

const MAX_SLIDES = 20

function extractHeadline(html) {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (h) return h[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
  const t = html.match(/>([^<]{4,80})<\//)
  return t ? t[1].trim().slice(0, 80) : ''
}

export default async function handler(req, res) {
  const auth = await getUserClient(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { user, db } = auth

  const { id: carouselId } = req.query
  if (!carouselId) return res.status(400).json({ error: 'carouselId required' })

  // Verify ownership
  const { data: carousel } = await db
    .from('carousels').select('id, aspect_ratio')
    .eq('id', carouselId).eq('user_id', user.id).single()
  if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('slides').select('id, html, previous_versions, slide_order, notes, headline, created_at')
      .eq('carousel_id', carouselId).order('slide_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ slides: data })
  }

  if (req.method === 'POST') {
    const { html, notes = '' } = req.body || {}
    if (!html?.trim()) return res.status(400).json({ error: 'html is required' })

    const { count } = await db
      .from('slides').select('id', { count: 'exact', head: true }).eq('carousel_id', carouselId)
    if ((count || 0) >= MAX_SLIDES)
      return res.status(422).json({ error: `Max ${MAX_SLIDES} slides reached` })

    const { data, error } = await db
      .from('slides')
      .insert({ carousel_id: carouselId, html: html.trim(), slide_order: count || 0, notes, headline: extractHeadline(html) })
      .select().single()
    if (error) return res.status(500).json({ error: error.message })

    await db.from('carousels').update({ updated_at: new Date().toISOString() }).eq('id', carouselId)
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    const { slideIds } = req.body || {}
    if (!Array.isArray(slideIds)) return res.status(400).json({ error: 'slideIds array required' })

    await Promise.all(
      slideIds.map((sid, order) =>
        db.from('slides').update({ slide_order: order }).eq('id', sid).eq('carousel_id', carouselId)
      )
    )
    await db.from('carousels').update({ updated_at: new Date().toISOString() }).eq('id', carouselId)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
