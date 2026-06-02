/**
 * utils-slide-html.js — Worker-side copy of the slide-html utility.
 *
 * The frontend uses src/lib/slide-html.js (ES module).
 * The Hetzner worker (CommonJS) imports from this file instead.
 * Logic is identical — only the module format differs.
 */

'use strict'

const DIMENSIONS = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
}

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
      if (name && !generics.has(name.toLowerCase())) families.add(name)
    }
  }
  return Array.from(families)
}

function wrapSlideHtmlForExport(slideHtml, aspectRatio, inlineFontCss = '') {
  const dims = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']
  const { width, height } = dims
  const fontBlock = inlineFontCss ? `<style>${inlineFontCss}</style>` : ''
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

module.exports = { wrapSlideHtmlForExport, extractFontFamilies, DIMENSIONS }
