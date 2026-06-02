/**
 * api/carousels.js
 * GET  /api/carousels   — list user's carousels (newest first)
 * POST /api/carousels   — create a new carousel
 */

import { getUserClient } from './_supabase.js'

export default async function handler(req, res) {
  const auth = await getUserClient(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { user, db } = auth

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('carousels')
      .select(`id, name, aspect_ratio, template, caption, hashtags,
               brand_note, export_url, is_template, tags, created_at, updated_at,
               slides ( id, slide_order, headline, notes )`)
      .eq('user_id', user.id)
      .eq('is_template', false)
      .order('updated_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ carousels: data })
  }

  if (req.method === 'POST') {
    const { name, aspectRatio, template } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

    const validRatios    = ['1:1', '4:5', '9:16']
    const validTemplates = ['listicle', 'myth', 'stats', 'steps', 'transform']

    const { data, error } = await db
      .from('carousels')
      .insert({
        user_id:      user.id,
        name:         name.trim(),
        aspect_ratio: validRatios.includes(aspectRatio) ? aspectRatio : '4:5',
        template:     validTemplates.includes(template) ? template : null,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
