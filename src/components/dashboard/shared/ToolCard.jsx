/**
 * Tool tile: icon + name + short description + arrow.
 * Used in the Free Tools pane to surface the 14 homepage tools.
 * Click opens a Sheet/Drawer with the tool's interactive UI.
 */

'use strict'

import React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICON_BG = {
  teal:   'bg-teal-50 text-teal-600',
  violet: 'bg-violet-100 text-violet-600',
  coral:  'bg-rose-50 text-rose-500',
  amber:  'bg-amber-50 text-amber-500',
  sky:    'bg-sky-50 text-sky-500',
  indigo: 'bg-indigo-50 text-indigo-500',
  slate:  'bg-slate-100 text-slate-600',
}

export default function ToolCard({ Icon, name, description, color = 'teal', onClick, disabled, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-all',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:-translate-y-px hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.12),_0_0_0_1px_rgba(20,184,166,0.2)]'
      )}
    >
      <div
        className={cn(
          'grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]',
          ICON_BG[color] || ICON_BG.teal
        )}
      >
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold leading-tight">{name}</span>
          {badge && (
            <span className="inline-flex items-center rounded-[5px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-[#64756f]">{description}</div>
      </div>
      <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-[#64756f]" />
    </button>
  )
}
