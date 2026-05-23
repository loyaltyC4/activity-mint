/**
 * Square post thumbnail with hover overlay showing engagement stats.
 * Used in the Pulse pane's Recent Posts grid.
 *
 * Accepts either a gradient class (default fallback) or an actual image URL.
 */

'use strict'

import React from 'react'
import { Heart, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const GRADIENTS = [
  'from-teal-100 to-teal-200',
  'from-violet-100 to-violet-200',
  'from-rose-100 to-amber-200',
  'from-yellow-100 to-amber-200',
  'from-sky-100 to-indigo-200',
  'from-amber-50 to-rose-100',
]

function fmt(n) {
  if (n === null || n === undefined) return '--'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

export default function PostThumb({
  imageUrl,
  emoji,
  likes,
  comments,
  gradientIndex = 0,
  onClick,
}) {
  const grad = GRADIENTS[gradientIndex % GRADIENTS.length]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative aspect-square cursor-pointer overflow-hidden rounded-[14px] bg-gradient-to-br transition-transform hover:scale-[1.03]',
        grad
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-3xl">{emoji || '📸'}</div>
      )}
      <div className="absolute inset-0 flex flex-col justify-end rounded-[14px] bg-teal-950/55 p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-white">
          <Heart className="h-3 w-3" /> {fmt(likes)}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-white">
          <MessageCircle className="h-3 w-3" /> {fmt(comments)}
        </div>
      </div>
    </button>
  )
}
