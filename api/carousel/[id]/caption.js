/**
 * api/carousel/[id]/caption.js — Vercel Serverless Function
 *
 * PUT /api/carousel/:id/caption
 * Body: { caption: string, hashtags: string[] }
 *
 * Called by the Claude chat handler when Claude fires the save_caption tool.
 * Also callable directly from the editor's caption form.
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
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { id: carouselId } = req.query
  if (!carouselId) return res.status(400).json({ error: 'carouselId is required' })

  const { caption, hashtags } = req.body || {}

  if (!caption || typeof caption !== 'string') {
    return res.status(400).json({ error: 'caption is required' })
  }
  if (!Array.isArray(hashtags)) {
    return res.status(400).json({ error: 'hashtags must be an array' })
  }

  const { data, error } = await supabase
    .from('carousels')
    .update({
      caption:    caption.trim(),
      hashtags:   hashtags.map(h => h.replace(/^#/, '').trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    })
    .eq('id', carouselId)
    .eq('user_id', user.id)
    .select('id, caption, hashtags')
    .single()

  if (error) {
    return error.code === 'PGRST116'
      ? res.status(404).json({ error: 'Carousel not found' })
      : res.status(500).json({ error: error.message })
  }

  return res.status(200).json(data)
}
