/**
 * api/carousel/[id].js — Vercel Serverless Function
 *
 * GET    /api/carousel/:id     — fetch carousel with all slides (ordered)
 * PATCH  /api/carousel/:id     — update name, template, aspect_ratio, tags
 * DELETE /api/carousel/:id     — delete carousel and all slides (cascade)
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  return error ? null : user
}

async function ownsCarousel(userId, carouselId) {
  const { data } = await supabase
    .from('carousels')
    .select('id')
    .eq('id', carouselId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id is required' })

  // ── GET: fetch carousel + slides ──────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('carousels')
      .select(`
        id, name, aspect_ratio, template, caption, hashtags,
        brand_note, export_url, is_template, tags, created_at, updated_at,
        slides (
          id, html, previous_versions, slide_order, notes, headline, created_at
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return error.code === 'PGRST116'
        ? res.status(404).json({ error: 'Carousel not found' })
        : res.status(500).json({ error: error.message })
    }

    // Sort slides by slide_order (Supabase doesn't guarantee order on join)
    if (data.slides) {
      data.slides.sort((a, b) => a.slide_order - b.slide_order)
    }

    return res.status(200).json(data)
  }

  // ── PATCH: update carousel metadata ───────────────────────────────────
  if (req.method === 'PATCH') {
    if (!(await ownsCarousel(user.id, id))) {
      return res.status(404).json({ error: 'Carousel not found' })
    }

    const { name, template, aspectRatio, tags } = req.body || {}
    const updates = {}

    if (name && typeof name === 'string') updates.name = name.trim()
    if (template !== undefined) {
      const valid = ['listicle', 'myth', 'stats', 'steps', 'transform', null]
      if (valid.includes(template)) updates.template = template
    }
    if (aspectRatio) {
      const valid = ['1:1', '4:5', '9:16']
      if (valid.includes(aspectRatio)) updates.aspect_ratio = aspectRatio
    }
    if (Array.isArray(tags)) updates.tags = tags

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data, error } = await supabase
      .from('carousels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── DELETE: remove carousel + slides (cascade) ─────────────────────────
  if (req.method === 'DELETE') {
    if (!(await ownsCarousel(user.id, id))) {
      return res.status(404).json({ error: 'Carousel not found' })
    }

    const { error } = await supabase
      .from('carousels')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
