/**
 * api/carousel/[id].js
 * GET    /api/carousel/:id   — fetch carousel with slides ordered
 * PATCH  /api/carousel/:id   — update name/template/aspectRatio/tags
 * DELETE /api/carousel/:id   — delete (slides cascade)
 */

import { getUserClient } from '../_supabase.js'

export default async function handler(req, res) {
  const auth = await getUserClient(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { user, db } = auth

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id is required' })

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('carousels')
      .select(`id, name, aspect_ratio, template, caption, hashtags,
               brand_note, export_url, is_template, tags, created_at, updated_at,
               slides ( id, html, previous_versions, slide_order, notes, headline, created_at )`)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) return error.code === 'PGRST116'
      ? res.status(404).json({ error: 'Carousel not found' })
      : res.status(500).json({ error: error.message })

    if (data.slides) data.slides.sort((a, b) => a.slide_order - b.slide_order)
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { name, template, aspectRatio, tags } = req.body || {}
    const updates = {}
    if (name?.trim())                                         updates.name         = name.trim()
    if (['listicle','myth','stats','steps','transform',null].includes(template)) updates.template = template
    if (['1:1','4:5','9:16'].includes(aspectRatio))           updates.aspect_ratio = aspectRatio
    if (Array.isArray(tags))                                  updates.tags         = tags

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' })

    const { data, error } = await db
      .from('carousels').update(updates).eq('id', id).eq('user_id', user.id).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('carousels').delete().eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
