/**
 * BrandDNABadge — compact brand identity display in the carousel editor header.
 * Shows the extracted color palette and font names so the user can see what
 * visual identity Claude is working with.
 */
'use strict'

import React from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

export default function BrandDNABadge({ brandDNA, handle, onRefresh }) {
  if (!brandDNA) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ring-foreground/[0.08] text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-brand" strokeWidth={2} />
        No brand data — run analysis first
      </div>
    )
  }

  const swatches = [
    { color: brandDNA.primaryColor,    title: 'Primary' },
    { color: brandDNA.accentColor,     title: 'Accent' },
    { color: brandDNA.backgroundColor, title: 'Background' },
  ].filter(s => s.color)

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg ring-1 ring-foreground/[0.08] bg-surface-2/50">
      {/* Color swatches */}
      <div className="flex items-center gap-1" title="Brand colors">
        {swatches.map((s) => (
          <div
            key={s.color}
            className="size-4 rounded-full ring-1 ring-foreground/15 shrink-0"
            style={{ background: s.color }}
            title={`${s.title}: ${s.color}`}
          />
        ))}
      </div>

      <div className="h-3.5 w-px bg-hairline" />

      {/* Font names */}
      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]" title="Heading font">
        {brandDNA.headingFont || 'Inter'}
      </span>

      <div className="h-3.5 w-px bg-hairline" />

      {/* Handle */}
      {handle && (
        <span className="text-[10px] font-mono text-brand-ink truncate">@{handle}</span>
      )}

      {/* Refresh */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="size-5 grid place-items-center rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Re-run brand analysis"
        >
          <RefreshCw className="size-3" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
