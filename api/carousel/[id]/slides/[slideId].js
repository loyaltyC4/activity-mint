/**
 * api/carousel/[id]/slides/[slideId].js
 * PUT    — update slide HTML (saves version history)
 * DELETE — delete slide, re-order remaining
 */

import { getUserClient } from '../../../_supabase.js'

const MAX_VERSIONS = 5

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

  const { id: carouselId, slideId } = req.query
  if (!carouselId || !slideId) return res.status(400).json({ error: 'carouselId and slideId required' })

  // Verify ownership via carousel
  const { data: carousel } = await db
    .from('carousels').select('id').eq('id', carouselId).eq('user_id', user.id).single()
  if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

  if (req.method === 'PUT') {
    const { html, notes } = req.body || {}
    if (!html?.trim()) return res.status(400).json({ error: 'html is required' })

    const { data: current } = await db
      .from('slides').select('html, previous_versions').eq('id', slideId).eq('carousel_id', carouselId).single()
    if (!current) return res.status(404).json({ error: 'Slide not found' })

    const previousVersions = [...(current.previous_versions || [])]
    if (current.html && current.html !== html.trim()) {
      previousVersions.push(current.html)
      if (previousVersions.length > MAX_VERSIONS) previousVersions.shift()
    }

    const updates = { html: html.trim(), previous_versions: previousVersions, headline: extractHeadline(html) }
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await db
      .from('slides').update(updates).eq('id', slideId).eq('carousel_id', carouselId).select().single()
    if (error) return res.status(500).json({ error: error.message })

    await db.from('carousels').update({ updated_at: new Date().toISOString() }).eq('id', carouselId)
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { data: slide } = await db
      .from('slides').select('slide_order').eq('id', slideId).eq('carousel_id', carouselId).single()
    if (!slide) return res.status(404).json({ error: 'Slide not found' })

    await db.from('slides').delete().eq('id', slideId)

    const { data: remaining } = await db
      .from('slides').select('id, slide_order').eq('carousel_id', carouselId)
      .gt('slide_order', slide.slide_order).order('slide_order', { ascending: true })

    if (remaining?.length) {
      await Promise.all(remaining.map(s =>
        db.from('slides').update({ slide_order: s.slide_order - 1 }).eq('id', s.id)
      ))
    }

    await db.from('carousels').update({ updated_at: new Date().toISOString() }).eq('id', carouselId)
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
