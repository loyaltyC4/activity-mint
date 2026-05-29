/**
 * KPI tile — Insight Flow design system.
 *
 * Backward-compatible with existing PulsePane props:
 *   sparkColor → color   (old name supported as alias)
 *   trendLabel → delta   (old name supported)
 *   Icon       → icon    (capital-I prop supported)
 *   index                (ignored — was used for stagger, now CSS-driven)
 *
 * New behaviour:
 *   - Shimmer loading state (loading={true})
 *   - Animated bar sparkline columns with staggered entrance
 *   - Inter Tight for the value, JetBrains Mono for the label
 *   - 28×28 icon tile (7px radius, brand-soft tinted)
 *   - shadow-glow on hover
 *   - Count-up animation on first render
 */

'use strict'

import React, { useId, useMemo, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Color maps ────────────────────────────────────────────────────────────
const COLORS = {
  teal:   { stroke: 'var(--brand)',          tile: 'var(--brand-soft)',        icon: 'var(--brand)' },
  sky:    { stroke: 'oklch(0.68 0.13 230)',  tile: 'oklch(0.96 0.03 230)',    icon: 'oklch(0.55 0.13 230)' },
  coral:  { stroke: 'var(--negative)',       tile: 'oklch(0.96 0.04 25)',     icon: 'var(--negative)' },
  violet: { stroke: 'var(--violet)',         tile: 'oklch(0.95 0.04 290)',    icon: 'var(--violet)' },
  amber:  { stroke: 'var(--amber)',          tile: 'oklch(0.96 0.04 75)',     icon: 'var(--amber)' },
  green:  { stroke: 'var(--positive)',       tile: 'oklch(0.94 0.04 160)',    icon: 'var(--positive)' },
}

// ── Animated bar sparkline ─────────────────────────────────────────────────
function BarSparkline({ data = [], color = 'teal', delay = 0 }) {
  const cols = COLORS[color] || COLORS.teal

  const bars = useMemo(() => {
    const safe = Array.isArray(data) ? data.filter(Number.isFinite).slice(-10) : []
    if (safe.length === 0) return [0.12, 0.22, 0.18, 0.35, 0.28, 0.45, 0.38, 0.6, 0.5, 0.75]
    const mx = Math.max(...safe, 0.001)
    return safe.map((v) => Math.max(0.08, v / mx))
  }, [data])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 28, marginTop: 10 }}>
      {bars.map((pct, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            borderRadius: 3,
            background: cols.stroke,
            opacity: 0.28 + pct * 0.72,
            '--fill-w': `${Math.round(pct * 100)}%`,
            height: `${Math.round(pct * 100)}%`,
            animation: `bar-fill 0.9s cubic-bezier(0.19,1,0.22,1) ${delay + i * 50}ms both`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  )
}

// ── Count-up hook ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(0)
  const frame = useRef(null)
  const start = useRef(null)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) { setVal(target || 0); return }
    if (frame.current) cancelAnimationFrame(frame.current)
    start.current = null

    const tick = (ts) => {
      if (!start.current) start.current = ts
      const pct = Math.min((ts - start.current) / duration, 1)
      const ease = 1 - Math.pow(1 - pct, 3)
      setVal(target * ease)
      if (pct < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target])

  return val
}

// ── Format helpers ─────────────────────────────────────────────────────────
function formatVal(raw, animatedNum) {
  // If the raw value is already a formatted string (e.g. "6.4%" "48.2k") return it
  if (typeof raw === 'string') return raw
  // Use animated number for pure numeric values
  const v = animatedNum
  if (!Number.isFinite(v)) return '--'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`
  if (v < 10 && v % 1 !== 0) return v.toFixed(1)
  return Math.round(v).toLocaleString()
}

// ── Main KpiCard ───────────────────────────────────────────────────────────
export default function KpiCard({
  // New prop names
  label = '',
  value,
  delta,
  trend = 'up',
  color,
  icon: iconProp,
  sparkData = [],
  loading = false,
  className,
  style,
  // Legacy prop aliases (PulsePane compat)
  sparkColor,        // alias for color
  trendLabel,        // alias for delta
  Icon: IconProp,    // alias for icon (capital-I)
  emptyHint,         // accepted but unused (new bars handle empty state)
  index,             // accepted but unused (stagger now CSS-driven)
}) {
  // Resolve aliases
  const resolvedColor = color || sparkColor || 'teal'
  const resolvedDelta = delta || trendLabel || null
  const resolvedIcon  = iconProp || IconProp || null

  const cols = COLORS[resolvedColor] || COLORS.teal
  const isUp = trend !== 'down' && !String(resolvedDelta || '').startsWith('↓')

  // Count-up only works for pure numeric values
  const numericTarget = typeof value === 'number' ? value : parseFloat(value) || 0
  const animated = useCountUp(numericTarget, 650)
  const displayVal = formatVal(value, animated)

  // ── Shimmer loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={cn('rounded-2xl overflow-hidden', className)}
        style={{
          padding: 16, minHeight: 116,
          background: 'oklch(0.985 0.003 240)',
          border: '1px solid oklch(0.91 0.005 240)',
          position: 'relative',
          ...style,
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.7) 50%,transparent 100%)',
          animation: 'shimmer 1.4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{ height: 10, width: '52%', borderRadius: 5,
          background: 'oklch(0.92 0.005 240)', marginBottom: 10 }} />
        <div style={{ height: 24, width: '38%', borderRadius: 5,
          background: 'oklch(0.92 0.005 240)', marginBottom: 6 }} />
        <div style={{ height: 9,  width: '58%', borderRadius: 5,
          background: 'oklch(0.92 0.005 240)', marginBottom: 12 }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 22 }}>
          {[0.4,0.6,0.5,0.8,0.65,0.9,0.75,1,0.85,0.95].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h * 100}%`, borderRadius: 3,
              background: 'oklch(0.92 0.005 240)',
            }} />
          ))}
        </div>
      </div>
    )
  }

  // ── Normal state ──────────────────────────────────────────────────────
  return (
    <div
      className={cn('rounded-2xl', className)}
      style={{
        padding: '16px',
        minHeight: 116,
        background: '#fff',
        border: '1px solid oklch(0.91 0.005 240)',
        boxShadow: 'var(--shadow-pane)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.18s',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-glow)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-pane)' }}
    >
      {/* JetBrains Mono label */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10.5, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'oklch(0.5 0.01 240)',
        paddingRight: resolvedIcon ? 38 : 0,
        marginBottom: 6,
        lineHeight: 1.3,
      }}>{label}</div>

      {/* Icon tile — top right */}
      {resolvedIcon && (() => {
        const Ic = resolvedIcon
        return (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: 7,
            background: cols.tile,
            display: 'grid', placeItems: 'center',
          }}>
            <Ic style={{ width: 14, height: 14, color: cols.icon }} />
          </div>
        )
      })()}

      {/* Inter Tight value */}
      <div style={{
        fontFamily: '"Inter Tight", Inter, sans-serif',
        fontSize: 26, fontWeight: 700,
        letterSpacing: '-0.8px', lineHeight: 1,
        color: cols.stroke,
        marginBottom: 4,
      }}>{displayVal}</div>

      {/* Delta / trend label */}
      {resolvedDelta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          fontSize: 11.5, fontWeight: 500,
          color: isUp ? 'var(--positive)' : 'var(--negative)',
        }}>
          <span style={{ fontSize: 10 }}>{isUp ? '↗' : '↘'}</span>
          <span>{resolvedDelta}</span>
        </div>
      )}

      {/* Animated bar sparkline */}
      <BarSparkline data={sparkData} color={resolvedColor} />
    </div>
  )
}

export { BarSparkline }
