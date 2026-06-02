/**
 * api/carousels.js — Vercel Serverless Function
 *
 * GET  /api/carousels          — list user's carousels (newest first)
 * POST /api/carousels          — create a new carousel
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

export default async function handler(req, res) {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // ── GET: list carousels ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('carousels')
      .select(`
        id, name, aspect_ratio, template, caption, hashtags,
        brand_note, export_url, is_template, tags, created_at, updated_at,
        slides ( id, slide_order, headline, notes )
      `)
      .eq('user_id', user.id)
      .eq('is_template', false)
      .order('updated_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ carousels: data })
  }

  // ── POST: create carousel ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, aspectRatio, template } = req.body || {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }

    const validRatios = ['1:1', '4:5', '9:16']
    const ratio = validRatios.includes(aspectRatio) ? aspectRatio : '4:5'

    const validTemplates = ['listicle', 'myth', 'stats', 'steps', 'transform']
    const tmpl = validTemplates.includes(template) ? template : null

    const { data, error } = await supabase
      .from('carousels')
      .insert({
        user_id:      user.id,
        name:         name.trim(),
        aspect_ratio: ratio,
        template:     tmpl,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
