/**
 * StoryRing — contemporary Instagram-style story ring.
 *
 * Active stories: a 3-colour conic-gradient ring (pink → orange → yellow →
 * purple) around a circular thumbnail with a 2px white gap (double-ring look).
 * Gentle pulse animation on the gradient ring signals "live/active".
 *
 * Seen stories: greyed-out ring, no pulse.
 * Add-story button: dashed grey ring with a + icon.
 *
 * The `thumb` prop:
 *   - HTTP/HTTPS URL → rendered as <img> with object-cover
 *   - Emoji / short text → centered text in gradient-fill fallback circle
 *   - Anything else → camera icon fallback
 */

'use strict'

import React, { useState } from 'react'
import { Plus, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZE   = 58  // outer ring diameter px
const RING   = 3   // gradient stroke thickness px
const GAP    = 2   // white gap between ring and inner image px
const INNER  = SIZE - (RING + GAP) * 2

function isUrl(s) {
  return typeof s === 'string' && (s.startsWith('http') || s.startsWith('//') || s.startsWith('data:'))
}

export default function StoryRing({ thumb, label, seen, addNew, onClick }) {
  const [imgErr, setImgErr] = useState(false)

  /* ── Add-story ring ─────────────────────────────────────────────────── */
  if (addNew) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onClick}
          className="grid place-items-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-teal-400 hover:text-teal-500 transition-colors cursor-pointer"
          style={{ width: SIZE, height: SIZE }}
        >
          <Plus className="h-5 w-5" />
        </button>
        {label && <span className="text-[10px] text-[#64756f] truncate max-w-[62px] text-center">{label}</span>}
      </div>
    )
  }

  /* ── Content inside the inner circle ───────────────────────────────── */
  const hasImage = isUrl(thumb) && !imgErr
  const inner = hasImage ? (
    <img
      src={thumb}
      alt={label || 'story'}
      onError={() => setImgErr(true)}
      style={{ width: INNER, height: INNER, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  ) : (
    <div
      style={{
        width: INNER, height: INNER, borderRadius: '50%',
        background: seen ? '#e2e8f0' : 'linear-gradient(135deg, #a855f7 0%, #f9317c 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {typeof thumb === 'string' && thumb.length <= 2 ? (
        <span style={{ fontSize: INNER * 0.38, lineHeight: 1 }} role="img" aria-label={label}>{thumb}</span>
      ) : (
        <Camera style={{ width: INNER * 0.38, height: INNER * 0.38, color: 'white' }} />
      )}
    </div>
  )

  /* ── Outer gradient ring ────────────────────────────────────────────── */
  const ringBg = seen
    ? '#e2e8f0'
    : 'conic-gradient(from 0deg, #f9317c 0%, #f77737 30%, #ffdb70 55%, #a855f7 78%, #f9317c 100%)'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'cursor-pointer transition-transform duration-200',
          'hover:scale-[1.07] active:scale-95 focus:outline-none'
        )}
        style={{
          width: SIZE, height: SIZE, borderRadius: '50%',
          background: ringBg,
          padding: RING + GAP,
          display: 'grid', placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* white separator ring */}
        <div
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'white',
            display: 'grid', placeItems: 'center',
            overflow: 'hidden',
          }}
        >
          {inner}
        </div>
      </button>
      {label && <span className="text-[10px] text-[#64756f] truncate max-w-[62px] text-center">{label}</span>}
    </div>
  )
}
