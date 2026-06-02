/**
 * api/carousel/[id]/caption.js
 * PUT /api/carousel/:id/caption  — save caption + hashtags
 */

import { getUserClient } from '../../_supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await getUserClient(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { user, db } = auth

  const { id: carouselId } = req.query
  const { caption, hashtags } = req.body || {}

  if (!caption?.trim()) return res.status(400).json({ error: 'caption is required' })
  if (!Array.isArray(hashtags)) return res.status(400).json({ error: 'hashtags must be an array' })

  const { data, error } = await db
    .from('carousels')
    .update({
      caption:    caption.trim(),
      hashtags:   hashtags.map(h => h.replace(/^#/, '').trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    })
    .eq('id', carouselId).eq('user_id', user.id)
    .select('id, caption, hashtags').single()

  if (error) return error.code === 'PGRST116'
    ? res.status(404).json({ error: 'Carousel not found' })
    : res.status(500).json({ error: error.message })

  return res.status(200).json(data)
}
