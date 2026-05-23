/**
 * Sticky topbar: logo + app name + active handle pill on the left,
 * time-range buttons + refresh + settings + upgrade on the right.
 */

'use strict'

import React from 'react'
import { Settings, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const RANGES = [
  { id: '7d',  label: '7d'  },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
]

export default function Topbar({ user, timeRange, onTimeRangeChange, onSettingsClick }) {
  const handleDisplay = user?.user_metadata?.tracked_handle || user?.email?.split('@')[0] || 'admin'

  return (
    <header className="sticky top-0 z-50 border-b border-[#e0eae7] bg-[#f7faf9]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-2.5">
        {/* Left: logo + name + handle pill */}
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-teal-500 text-sm font-extrabold text-white shadow-[0_4px_14px_-2px_rgba(20,184,166,0.45)]">
            M
          </div>
          <span className="text-[15px] font-bold tracking-tight">Activity Mint</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f4f3] px-3 py-1 text-xs text-[#64756f]">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            @{handleDisplay}
          </span>
        </div>

        {/* Right: range, refresh, settings, upgrade */}
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-[10px] bg-[#f0f4f3] p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => onTimeRangeChange(r.id)}
                className={cn(
                  "rounded-[7px] px-2.5 py-1 text-xs font-semibold transition-all",
                  timeRange === r.id
                    ? "bg-white text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                    : "text-[#64756f] hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#e0eae7] bg-white px-3 py-1.5 text-xs font-semibold text-[#64756f] transition-colors hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={onSettingsClick}
            title="Settings"
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[#e0eae7] bg-white transition-colors hover:bg-[#f0f4f3]"
          >
            <Settings className="h-4 w-4 text-[#64756f]" />
          </button>

          <button className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#042f2e] px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.04]">
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade
          </button>
        </div>
      </div>
    </header>
  )
}
