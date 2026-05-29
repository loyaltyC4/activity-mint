/**
 * Topbar — Insight Flow design system.
 * 58px height, full-width (no max-w), brand icon tile, JetBrains Mono labels.
 * Unified with landing page Minted Bento palette.
 */

'use strict'

import React from 'react'
import { Settings, RotateCcw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const RANGES = [
  { id: '7d',  label: '7d'  },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
]

export default function Topbar({ user, timeRange, onTimeRangeChange, onSettingsClick }) {
  const handleDisplay = user?.user_metadata?.tracked_handle || user?.email?.split('@')[0] || 'you'

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 58, flexShrink: 0,
        borderBottom: '1px solid oklch(0.91 0.005 240)',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center',
      }}
    >
      <div style={{
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '0 20px 0 0',
        /* NOTE: no left padding — sidebar sits flush at 228px */
      }}>

        {/* Left: logo tile + wordmark + handle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16 }}>
          {/* Brand icon tile */}
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--brand)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px oklch(0.72 0.13 180 / 0.3)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.916a2 2 0 00-1.272 1.272L12 21l-1.912-5.812a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272L12 3z"/>
            </svg>
          </div>

          {/* Wordmark */}
          <span style={{
            fontFamily: '"Inter Tight", Inter, sans-serif',
            fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px',
            color: 'oklch(0.16 0.01 240)',
          }}>Activity Mint</span>

          {/* Handle pill */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'oklch(0.985 0.003 240)',
            border: '1px solid oklch(0.91 0.005 240)',
            borderRadius: 999, padding: '3px 10px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11, fontWeight: 500,
            color: 'oklch(0.5 0.01 240)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--brand)', flexShrink: 0,
            }} />
            @{handleDisplay}
          </span>
        </div>

        {/* Right: range + refresh + settings + upgrade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

          {/* Time range group */}
          <div style={{
            display: 'flex', gap: 2,
            background: 'oklch(0.97 0.003 240)',
            borderRadius: 9, padding: 3,
            border: '1px solid oklch(0.91 0.005 240)',
          }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => onTimeRangeChange(r.id)}
                style={{
                  borderRadius: 6, padding: '3px 10px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.12s',
                  background: timeRange === r.id
                    ? '#fff'
                    : 'transparent',
                  color: timeRange === r.id
                    ? 'oklch(0.16 0.01 240)'
                    : 'oklch(0.5 0.01 240)',
                  boxShadow: timeRange === r.id
                    ? '0 1px 4px oklch(0 0 0 / 0.06)'
                    : 'none',
                }}
              >{r.label}</button>
            ))}
          </div>

          {/* Refresh */}
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 8, border: '1px solid oklch(0.91 0.005 240)',
              background: '#fff', padding: '5px 10px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              color: 'oklch(0.5 0.01 240)', cursor: 'pointer',
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.97 0.003 240)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
            onClick={() => window.location.reload()}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            Refresh
          </button>

          {/* Settings */}
          <button
            onClick={onSettingsClick}
            title="Settings"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid oklch(0.91 0.005 240)',
              background: '#fff', display: 'grid', placeItems: 'center',
              cursor: 'pointer', transition: 'background 0.12s',
              color: 'oklch(0.5 0.01 240)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.97 0.003 240)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
          >
            <Settings style={{ width: 14, height: 14 }} />
          </button>

          {/* Upgrade CTA */}
          <button
            onClick={() => window.location.href = '/#pricing'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--ink)', color: '#fff',
              padding: '5px 12px',
              fontFamily: '"Inter Tight", Inter, sans-serif',
              fontSize: 12, fontWeight: 700,
              letterSpacing: '-0.01em',
              transition: 'opacity 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.82' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Zap style={{ width: 12, height: 12 }} />
            Upgrade
          </button>
        </div>
      </div>
    </header>
  )
}
