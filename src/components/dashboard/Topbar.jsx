/**
 * Topbar — exact port of insight-flow's Topbar.tsx
 * h-16, streaming indicator, range picker, refresh, settings, upgrade.
 */
'use strict'
import React, { useState } from 'react'
import { RefreshCw, Settings as SettingsIcon, Sparkles } from 'lucide-react'

const RANGES = ['7d', '30d', '90d']

export default function Topbar({
  title, subtitle,
  timeRange, onTimeRangeChange,
  onSettingsClick,
  user,
}) {
  const [refreshing, setRefreshing] = useState(false)
  const accountTag = user?.user_metadata?.tracked_handle
    ? `@${user.user_metadata.tracked_handle}`
    : `@${user?.email?.split('@')[0] || 'you'}`

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1500)
  }

  return (
    <header className="h-16 px-6 lg:px-8 border-b border-hairline bg-background/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4 flex-shrink-0">

      {/* Left: live dot + title + account tag */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-2 rounded-full bg-positive animate-pulse flex-shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold tracking-tight text-base truncate">
              {title}
            </h2>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-brand-soft text-brand-ink flex-shrink-0">
              {accountTag}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: range + refresh + settings + divider + upgrade */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Time range picker */}
        <div className="flex p-0.5 bg-foreground/[0.04] rounded-lg ring-1 ring-foreground/5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onTimeRangeChange?.(r)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                timeRange === r
                  ? 'bg-card text-foreground shadow-pane'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`}
            strokeWidth={2}
          />
          <span className="hidden sm:inline">{refreshing ? 'Syncing' : 'Refresh'}</span>
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="size-8 grid place-items-center rounded-lg text-foreground/60 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
          title="Settings"
        >
          <SettingsIcon className="size-4" strokeWidth={1.75} />
        </button>

        <div className="h-5 w-px bg-hairline mx-1" />

        {/* Upgrade */}
        <button
          onClick={() => window.location.href = '/#pricing'}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all"
        >
          <Sparkles className="size-3.5" strokeWidth={2.25} />
          Upgrade
        </button>
      </div>
    </header>
  )
}
