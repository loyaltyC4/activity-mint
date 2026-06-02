/**
 * api/carousel/export.js — Vercel Serverless Function
 *
 * POST /api/carousel/export
 * Body: { carouselId: string }
 *
 * Flow:
 *   1. Fetch carousel + slides from Supabase
 *   2. Send export_slides action to Hetzner orchestrator
 *      (worker uses CloakBrowser to screenshot each slide at correct viewport)
 *   3. Receive base64 PNG array from worker
 *   4. Create a ZIP archive in memory
 *   5. Upload ZIP to Supabase Storage (bucket: carousel-exports)
 *   6. Update carousels.export_url with the public URL
 *   7. Return { exportUrl }
 *
 * The Supabase Storage bucket 'carousel-exports' must exist and be public.
 * Create it in Supabase Dashboard → Storage → New bucket → Name: carousel-exports → Public: ON
 */

import { getUserClient } from '../_supabase.js'
import archiver from 'archiver'
import { Writable } from 'stream'

export const config = { maxDuration: 120 }

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL
const SCRAPER_SECRET      = process.env.SCRAPER_SECRET

async function callExportScraper(slides, aspectRatio, carouselId) {
  if (!SCRAPER_SERVICE_URL) throw new Error('SCRAPER_SERVICE_URL is not configured')

  const res = await fetch(`${SCRAPER_SERVICE_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SCRAPER_SECRET ? { 'X-Secret': SCRAPER_SECRET } : {}),
    },
    body: JSON.stringify({
      action:  'export_slides',
      payload: { slides, aspectRatio, carouselId },
    }),
  })

  if (!res.ok) throw new Error(`Hetzner export action failed: HTTP ${res.status}`)
  const body = await res.json()
  if (!body.ok) throw new Error(`Hetzner export error: ${body.error}`)
  return body.items  // [{ id, order, png: base64 }]
}

async function buildZip(pngItems) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const writable = new Writable({
      write(chunk, _, cb) { chunks.push(chunk); cb() },
    })
    writable.on('finish', () => resolve(Buffer.concat(chunks)))
    writable.on('error', reject)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', reject)
    archive.pipe(writable)

    for (const item of pngItems) {
      const buf = Buffer.from(item.png, 'base64')
      archive.append(buf, { name: `slide-${String(item.order + 1).padStart(2, '0')}.png` })
    }

    archive.finalize()
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await getUserClient(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { user, db } = auth

  const { carouselId } = req.body || {}
  if (!carouselId) return res.status(400).json({ error: 'carouselId is required' })

  // ── Fetch carousel + slides ───────────────────────────────────────────
  const { data: carousel, error: carouselError } = await db
    .from('carousels')
    .select(`
      id, name, aspect_ratio,
      slides ( id, html, slide_order )
    `)
    .eq('id', carouselId)
    .eq('user_id', user.id)
    .single()

  if (carouselError || !carousel) {
    return res.status(404).json({ error: 'Carousel not found' })
  }

  const slides = (carousel.slides || [])
    .filter(s => s.html)
    .sort((a, b) => a.slide_order - b.slide_order)

  if (slides.length === 0) {
    return res.status(422).json({ error: 'Carousel has no slides to export' })
  }

  try {
    // ── Export via Hetzner worker ───────────────────────────────────────
    const pngItems = await callExportScraper(slides, carousel.aspect_ratio, carouselId)

    if (!pngItems || pngItems.length === 0) {
      return res.status(502).json({ error: 'Export worker returned no images' })
    }

    // ── Build ZIP ────────────────────────────────────────────────────────
    const zipBuffer = await buildZip(pngItems)

    // ── Upload to Supabase Storage ────────────────────────────────────────
    const filename = `${user.id}/${carouselId}/carousel-${Date.now()}.zip`

    const { error: uploadError } = await db.storage
      .from('carousel-exports')
      .upload(filename, zipBuffer, {
        contentType: 'application/zip',
        upsert:      true,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: publicData } = db.storage
      .from('carousel-exports')
      .getPublicUrl(filename)

    const exportUrl = publicData.publicUrl

    // ── Update carousel record ────────────────────────────────────────────
    await db
      .from('carousels')
      .update({ export_url: exportUrl, updated_at: new Date().toISOString() })
      .eq('id', carouselId)

    return res.status(200).json({
      ok:        true,
      exportUrl,
      slideCount: pngItems.length,
    })
  } catch (err) {
    console.error('[carousel/export] error:', err.message)
    return res.status(500).json({ error: err.message || 'Export failed' })
  }
}
