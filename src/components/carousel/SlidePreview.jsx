/**
 * SlidePreview — renders a single slide as a live iframe.
 *
 * Uses the same wrapSlideHtml() contract as the Hetzner export worker:
 * the iframe receives a full HTML document with CDN Google Font links
 * (fast for preview) while the worker uses base64-inlined fonts (for
 * Playwright screenshot). Both paths render identically.
 *
 * The iframe is rendered at native resolution (1080px wide) and scaled
 * via CSS transform: scale() to fit the available container width.
 * This avoids blurry CSS scaling artifacts.
 */
'use strict'

import React, { useRef, useState, useEffect } from 'react'

const DIMENSIONS = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
}

// ─── Inline wrapSlideHtml (ESM-safe copy; source-of-truth is src/lib/slide-html.js) ─

function extractFontFamilies(html) {
  const families = new Set()
  const regex = /font-family:\s*['"]?([^;'"\}\n]+?)['"]?\s*[;}"]/g
  const generics = new Set(['serif','sans-serif','monospace','cursive','fantasy','system-ui','inherit','initial','unset'])
  let match
  while ((match = regex.exec(html)) !== null) {
    for (const part of match[1].trim().split(',')) {
      const name = part.trim().replace(/['"]/g, '')
      if (name && !generics.has(name.toLowerCase())) families.add(name)
    }
  }
  return Array.from(families)
}

function wrapSlideHtml(slideHtml, aspectRatio) {
  const { width, height } = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']
  const families = extractFontFamilies(slideHtml)
  let fontBlock = ''
  if (families.length > 0) {
    const params = families.map(f => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800`).join('&')
    fontBlock = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${params}&display=block" rel="stylesheet">`
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${width}">${fontBlock}<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${slideHtml}</body></html>`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SlidePreview({ slide, aspectRatio = '4:5', className = '' }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  const { width: nativeW, height: nativeH } = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']

  // Compute the CSS scale factor to fit the iframe into the container
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      const scaleX = clientWidth  / nativeW
      const scaleY = clientHeight / nativeH
      setScale(Math.min(scaleX, scaleY, 1)) // never upscale
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [nativeW, nativeH])

  const scaledW = Math.round(nativeW * scale)
  const scaledH = Math.round(nativeH * scale)

  if (!slide) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-surface-2 rounded-xl ring-1 ring-foreground/[0.06] ${className}`}
      >
        <p className="text-sm text-muted-foreground">No slide selected</p>
      </div>
    )
  }

  const srcDoc = wrapSlideHtml(slide.html || '', aspectRatio)

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-surface-2 rounded-xl ring-1 ring-foreground/[0.08] overflow-hidden ${className}`}
    >
      {/* Checkerboard background so transparent slides are obvious */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(45deg, oklch(0.92 0.005 240) 25%, transparent 25%),' +
            'linear-gradient(-45deg, oklch(0.92 0.005 240) 25%, transparent 25%),' +
            'linear-gradient(45deg, transparent 75%, oklch(0.92 0.005 240) 75%),' +
            'linear-gradient(-45deg, transparent 75%, oklch(0.92 0.005 240) 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      />

      {/* The iframe rendered at native size, scaled to fit */}
      <div
        style={{
          width:  scaledW,
          height: scaledH,
          position: 'relative',
          zIndex: 1,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 2px 24px rgba(0,0,0,0.15)',
        }}
      >
        <iframe
          key={slide.id}     // remount when slide changes to force srcDoc refresh
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          title={`Slide preview — ${slide.notes || slide.headline || `slide ${(slide.slide_order ?? 0) + 1}`}`}
          style={{
            width:  nativeW,
            height: nativeH,
            border:   'none',
            display:  'block',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>

      {/* Slide number pill */}
      <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-foreground/60 text-white font-mono text-[10px] font-semibold backdrop-blur-sm">
        {(slide.slide_order ?? 0) + 1}
      </div>
    </div>
  )
}
