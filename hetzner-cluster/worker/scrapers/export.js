/**
 * export.js — Hetzner worker: slide HTML → PNG array via CloakBrowser
 *
 * Receives a payload of HTML slide strings and screenshots each one at
 * the correct viewport for the requested aspect ratio. Returns the PNGs
 * as base64 strings so the orchestrator can forward them to the caller
 * without needing filesystem access between services.
 *
 * Font loading strategy:
 *   - getInlinedFontCSS() fetches Google Fonts and converts woff2 to
 *     base64 data URIs so Playwright never makes external font requests.
 *   - Results are cached in-process (memory) and on-disk under
 *     /app/data/.font-cache/ — survives Docker restarts via a volume mount.
 *
 * payload: {
 *   slides: [{ id, html, slideOrder }]  — ordered array from Supabase
 *   aspectRatio: '1:1' | '4:5' | '9:16'
 *   carouselId: string                  — used for logging only
 * }
 *
 * returns: [{ id, order, png: string (base64) }]
 */

'use strict'

const path = require('path')
const { readFile, writeFile, mkdir } = require('fs/promises')
const { wrapSlideHtmlForExport, DIMENSIONS, extractFontFamilies } = require('./utils-slide-html')

// ─── Font cache ──────────────────────────────────────────────────────────────

const FONT_CACHE_DIR = path.resolve(process.cwd(), 'data', '.font-cache')
const fontMemCache = new Map()

/**
 * Fetch Google Fonts and inline all woff2 files as base64 data URIs.
 * Ported verbatim from open-carrusel/src/lib/fonts.ts.
 */
async function getInlinedFontCSS(families) {
  if (!families || families.length === 0) return ''
  const parts = []

  for (const family of families) {
    const cached = await getCachedFont(family)
    if (cached) { parts.push(cached); continue }

    try {
      const css = await fetchAndInlineFont(family)
      if (css) {
        await cacheFont(family, css)
        parts.push(css)
      }
    } catch {
      // Font unavailable — system fallback will be used
    }
  }

  return parts.join('\n')
}

async function getCachedFont(family) {
  if (fontMemCache.has(family)) return fontMemCache.get(family)
  try {
    const diskPath = path.join(FONT_CACHE_DIR, `${family.replace(/\s/g, '-')}.css`)
    const css = await readFile(diskPath, 'utf-8')
    fontMemCache.set(family, css)
    return css
  } catch {
    return null
  }
}

async function cacheFont(family, css) {
  fontMemCache.set(family, css)
  try {
    await mkdir(FONT_CACHE_DIR, { recursive: true })
    const diskPath = path.join(FONT_CACHE_DIR, `${family.replace(/\s/g, '-')}.css`)
    await writeFile(diskPath, css, 'utf-8')
  } catch {
    // Disk write failed — in-memory cache still works
  }
}

async function fetchAndInlineFont(family) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700;800&display=block`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!response.ok) return null
  let css = await response.text()

  const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g
  const matches = [...css.matchAll(urlRegex)]

  for (const match of matches) {
    const fontUrl = match[1]
    try {
      const fontResponse = await fetch(fontUrl)
      if (!fontResponse.ok) continue
      const buffer = await fontResponse.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      css = css.replace(fontUrl, `data:font/woff2;base64,${base64}`)
    } catch {
      // Keep the CDN URL — Playwright can still fetch it from the Hetzner server
    }
  }

  css = css.replace(/font-display:\s*swap/g, 'font-display: block')
  return css
}

// ─── Export action ────────────────────────────────────────────────────────────

async function exportSlides(page, payload, log) {
  const { slides, aspectRatio = '4:5', carouselId } = payload || {}

  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('export_slides: slides array is required and must be non-empty')
  }

  const dims = DIMENSIONS[aspectRatio]
  if (!dims) throw new Error(`export_slides: unsupported aspectRatio "${aspectRatio}"`)

  log.info(`export_slides: carouselId=${carouselId} slides=${slides.length} ratio=${aspectRatio} (${dims.width}×${dims.height})`)

  // Collect all unique font families across all slides so we fetch
  // each font only once rather than once per slide
  const allFamilies = new Set()
  for (const slide of slides) {
    extractFontFamilies(slide.html || '').forEach(f => allFamilies.add(f))
  }
  const inlineFontCss = await getInlinedFontCSS([...allFamilies])
  log.info(`export_slides: inlined ${allFamilies.size} font families`)

  const results = []

  for (const slide of slides) {
    const { id, html, slideOrder } = slide
    if (!html) {
      log.warn(`export_slides: slide ${id} has no html — skipping`)
      continue
    }

    const fullHtml = wrapSlideHtmlForExport(html, aspectRatio, inlineFontCss)

    await page.setViewportSize({ width: dims.width, height: dims.height })
    await page.setContent(fullHtml, { waitUntil: 'networkidle', timeout: 30_000 })

    // Wait for all fonts to finish loading — critical for pixel-perfect output
    await page.evaluate(() => document.fonts.ready)

    const pngBuffer = await page.screenshot({ type: 'png', fullPage: false })
    const pngBase64 = pngBuffer.toString('base64')

    results.push({ id, order: slideOrder ?? results.length, png: pngBase64 })
    log.info(`export_slides: screenshot slide ${slideOrder ?? results.length} (${pngBase64.length} bytes base64)`)
  }

  log.info(`export_slides: done — ${results.length} slides exported`)
  return results
}

module.exports = { exportSlides }
