/**
 * Insight card with optional tier-lock blur overlay.
 * Used in Pulse pane's plain-English insights list and in Trends pane.
 * When `locked` is true, the body is blurred and a pill overlay invites
 * the user to upgrade.
 */

'use strict'

import React from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

const TONE = {
  teal:   { bg: 'bg-teal-50',   ring: 'shadow-[0_0_0_1px_rgba(20,184,166,0.2)]',  iconBg: 'bg-teal-500/12'   },
  violet: { bg: 'bg-violet-100',ring: 'shadow-[0_0_0_1px_rgba(124,58,237,0.2)]',  iconBg: 'bg-violet-600/10' },
  coral:  { bg: 'bg-rose-50',   ring: 'shadow-[0_0_0_1px_rgba(244,63,94,0.2)]',   iconBg: 'bg-rose-500/10'   },
  amber:  { bg: 'bg-amber-50',  ring: 'shadow-[0_0_0_1px_rgba(245,158,11,0.25)]', iconBg: 'bg-amber-500/12'  },
}

export default function InsightCard({
  Icon,
  body,
  cta,
  tone = 'teal',
  locked,
  onUnlock,
}) {
  const t = TONE[tone] || TONE.teal
  return (
    <div className={cn('relative flex gap-3 rounded-2xl p-3.5', t.bg, t.ring)}>
      <div className={cn('grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]', t.iconBg)}>
        {Icon && <Icon className="h-[15px] w-[15px]" />}
      </div>
      <div className={cn(locked && 'pointer-events-none select-none blur-[3px]')}>
        <div className="text-[13px] leading-[1.45]">{body}</div>
        {cta && (
          <div className="mt-1 text-[11px] font-bold text-teal-600">→ {cta}</div>
        )}
      </div>
      {locked && (
        <button
          type="button"
          onClick={onUnlock}
          className="absolute inset-0 grid place-items-center rounded-2xl bg-white/35 backdrop-blur-[1.5px]"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-950 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_14px_rgba(4,47,46,0.3)]">
            <Lock className="h-3 w-3" />
            Unlock with Pro
          </span>
        </button>
      )}
    </div>
  )
}
