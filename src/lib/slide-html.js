/**
 * slide-html.js — Ported from open-carrusel src/lib/slide-html.ts
 *
 * THE shared rendering contract between:
 *   1. SlidePreview.jsx  — iframe preview (loads Google Fonts via CDN link)
 *   2. export scraper    — Hetzner Playwright screenshot (fonts inlined as base64)
 *
 * Only font-loading strategy differs between the two paths.
 * All other wrapping logic (dimensions, reset CSS, box-sizing) is identical.
 */

'use strict'

const DIMENSIONS = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
}

/**
 * Extract all font-family names referenced in a slide's inline styles.
 * Skips generic CSS family names (serif, sans-serif, monospace, etc.).
 *
 * @param {string} html  Body-level slide HTML
 * @returns {string[]}   Array of unique font family names
 */
function extractFontFamilies(html) {
  const families = new Set()
  const regex = /font-family:\s*['"]?([^;'"\}\n]+?)['"]?\s*[;}"]/g
  const generics = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'inherit', 'initial', 'unset',
  ])
  let match
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim()
    for (const part of raw.split(',')) {
      const name = part.trim().replace(/['"]/g, '')
      if (name && !generics.has(name.toLowerCase())) {
        families.add(name)
      }
    }
  }
  return Array.from(families)
}

/**
 * Wrap body-level slide HTML into a full document for iframe PREVIEW.
 * Uses Google Fonts CDN <link> — fast, no CORS issues in the browser.
 *
 * @param {string} slideHtml   Body-level HTML (no <html>, <head>, <body> tags)
 * @param {'1:1'|'4:5'|'9:16'} aspectRatio
 * @returns {string}           Full HTML document string
 */
function wrapSlideHtml(slideHtml, aspectRatio) {
  const dims = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']
  const { width, height } = dims
  const fontFamilies = extractFontFamilies(slideHtml)

  let fontBlock = ''
  if (fontFamilies.length > 0) {
    const params = fontFamilies
      .map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`)
      .join('&')
    fontBlock = `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?${params}&display=block" rel="stylesheet">`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}">
${fontBlock}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
</style>
</head>
<body>
${slideHtml}
</body>
</html>`
}

/**
 * Wrap body-level slide HTML into a full document for EXPORT (Playwright screenshot).
 * Fonts are inlined as base64 @font-face CSS — no external network requests needed.
 * This avoids CORS and timeout issues in Playwright/Puppeteer on the Hetzner workers.
 *
 * @param {string} slideHtml     Body-level HTML
 * @param {'1:1'|'4:5'|'9:16'} aspectRatio
 * @param {string} [inlineFontCss]  Pre-fetched base64 @font-face CSS from getInlinedFontCSS()
 * @returns {string}              Full HTML document string
 */
function wrapSlideHtmlForExport(slideHtml, aspectRatio, inlineFontCss = '') {
  const dims = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']
  const { width, height } = dims

  const fontBlock = inlineFontCss
    ? `<style>${inlineFontCss}</style>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}">
${fontBlock}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
</style>
</head>
<body>
${slideHtml}
</body>
</html>`
}

module.exports = { wrapSlideHtml, wrapSlideHtmlForExport, extractFontFamilies, DIMENSIONS }
