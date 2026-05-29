/**
 * KPI tile — Insight Flow design system.
 *
 * Shimmer loading → animated bar sparkline → value count-up.
 * Font: Inter Tight for numbers, JetBrains Mono for labels.
 * Icon tile: 28×28, 7px radius, color-matched.
 * shadow-glow on hover + featured cards.
 */

'use strict'

import React, { useId, useMemo, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Color maps ────────────────────────────────────────────────────────────
const COLORS = {
  teal:   { stroke: 'var(--brand)',    tile: 'var(--brand-soft)', icon: 'var(--brand)' },
  sky:    { stroke: 'oklch(0.68 0.13 230)', tile: 'oklch(0.96 0.03 230)', icon: 'oklch(0.55 0.13 230)' },
  coral:  { stroke: 'var(--negative)', tile: 'oklch(0.96 0.04 25)', icon: 'var(--negative)' },
  violet: { stroke: 'var(--violet)',   tile: 'oklch(0.95 0.04 290)', icon: 'var(--violet)' },
  amber:  { stroke: 'var(--amber)',    tile: 'oklch(0.96 0.04 75)', icon: 'var(--amber)' },
  green:  { stroke: 'var(--positive)', tile: 'oklch(0.94 0.04 160)', icon: 'var(--positive)' },
}

// ── Animated bar sparkline ─────────────────────────────────────────────────
function BarSparkline({ data = [], color = 'teal', animate = true }) {
  const cols = COLORS[color] || COLORS.teal
  const bars = useMemo(() => {
    const safe = Array.isArray(data) ? data.slice(-10) : []
    if (safe.length === 0) return Array(8).fill(0.15)
    const mx = Math.max(...safe, 0.001)
    return safe.map((v) => Math.max(0.08, (v / mx)))
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
            opacity: 0.3 + pct * 0.7,
            height: `${Math.round(pct * 100)}%`,
            '--fill-w': `${Math.round(pct * 100)}%`,
            animation: animate
              ? `bar-fill 0.9s cubic-bezier(0.19,1,0.22,1) ${i * 55}ms both`
              : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ── Smooth SVG area sparkline (fallback for single-value data) ─────────────
function AreaSparkline({ data = [], color = 'teal' }) {
  const id = useId()
  const cols = COLORS[color] || COLORS.teal
  const W = 120, H = 32

  const pts = useMemo(() => {
    const safe = Array.isArray(data) ? data.filter(Number.isFinite) : []
    if (safe.length < 2) return []
    const mn = Math.min(...safe), mx = Math.max(...safe)
    const rng = mx - mn || 1
    return safe.map((v, i) => ({
      x: (i / (safe.length - 1)) * W,
      y: H - 4 - ((v - mn) / rng) * (H - 8),
    }))
  }, [data])

  if (pts.length < 2) return (
    <div style={{ height: 28, marginTop: 10,
      display: 'flex', alignItems: 'flex-end', gap: 2.5 }}>
      {[0.2,0.4,0.3,0.6,0.5,0.8,0.7,1].map((h, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 3, height: `${h * 100}%`,
          background: cols.stroke, opacity: 0.15,
        }} />
      ))}
    </div>
  )

  const path = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
  const area = `${path} L${pts[pts.length-1].x},${H} L0,${H} Z`
  const last = pts[pts.length - 1]

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
         preserveAspectRatio="none" style={{ marginTop: 10, display: 'block' }}>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={cols.stroke} stopOpacity="0.2" />
          <stop offset="1" stopColor={cols.stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${id})`} />
      <path d={path} fill="none" stroke={cols.stroke} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={cols.stroke} />
    </svg>
  )
}

// ── Count-up hook ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 700, enabled = true) {
  const [val, setVal] = useState(0)
  const start = useRef(null)

  useEffect(() => {
    if (!enabled || typeof target !== 'number') { setVal(target); return }
    const step = (ts) => {
      if (!start.current) start.current = ts
      const pct = Math.min((ts - start.current) / duration, 1)
      const ease = 1 - Math.pow(1 - pct, 3) // cubic ease-out
      setVal(target * ease)
      if (pct < 1) requestAnimationFrame(step)
    }
    start.current = null
    requestAnimationFrame(step)
  }, [target, enabled])

  return val
}

// ── Format value ───────────────────────────────────────────────────────────
function fmt(raw, format, animated) {
  const v = animated ?? raw
  if (format === 'k')   return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toString()
  if (format === 'pct') return `${typeof v === 'number' ? v.toFixed(1) : v}%`
  if (format === 'int') return Math.round(v).toLocaleString()
  return `${Math.round(v)}`
}

// ── Main KpiCard ───────────────────────────────────────────────────────────
export default function KpiCard({
  label = '',
  value,
  format = 'int',
  delta,
  trend = 'up',
  color = 'teal',
  icon: IconComponent,
  sparkData = [],
  loading = false,
  className,
  style,
}) {
  const cols = COLORS[color] || COLORS.teal
  const animated = useCountUp(
    typeof value === 'number' ? value : 0,
    700,
    !loading && typeof value === 'number',
  )

  // Shimmer loading state
  if (loading) {
    return (
      <div className={cn('rounded-2xl overflow-hidden', className)}
           style={{
             padding: 16, minHeight: 110,
             background: 'oklch(0.985 0.003 240)',
             border: '1px solid oklch(0.91 0.005 240)',
             position: 'relative',
             ...style,
           }}>
        {/* Shimmer sweep */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.65) 50%,transparent 100%)',
          animation: 'shimmer 1.4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{ height: 11, width: '55%', borderRadius: 6,
          background: 'oklch(0.92 0.005 240)', marginBottom: 10 }} />
        <div style={{ height: 26, width: '40%', borderRadius: 6,
          background: 'oklch(0.92 0.005 240)', marginBottom: 8 }} />
        <div style={{ height: 10, width: '60%', borderRadius: 6,
          background: 'oklch(0.92 0.005 240)' }} />
      </div>
    )
  }

  const isUp = trend === 'up'
  const displayVal = fmt(value, format, animated)

  return (
    <div
      className={cn('rounded-2xl transition-shadow', className)}
      style={{
        padding: 16,
        minHeight: 110,
        background: '#fff',
        border: '1px solid oklch(0.91 0.005 240)',
        boxShadow: 'var(--shadow-pane)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-glow)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-pane)' }}
    >
      {/* Label */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'oklch(0.5 0.01 240)',
        marginBottom: 6,
        paddingRight: 36, // leave space for icon tile
      }}>{label}</div>

      {/* Icon tile — top right */}
      {IconComponent && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          width: 28, height: 28, borderRadius: 7,
          background: cols.tile,
          display: 'grid', placeItems: 'center',
        }}>
          <IconComponent style={{ width: 14, height: 14, color: cols.icon }} />
        </div>
      )}

      {/* Value */}
      <div style={{
        fontFamily: '"Inter Tight", Inter, sans-serif',
        fontSize: 26, fontWeight: 700,
        letterSpacing: '-0.8px', lineHeight: 1,
        color: cols.stroke,
        marginBottom: 4,
      }}>{displayVal}</div>

      {/* Delta */}
      {delta && (
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: isUp ? 'var(--positive)' : 'var(--negative)',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <span>{isUp ? '↗' : '↘'}</span>
          <span>{delta}</span>
          <span style={{ color: 'oklch(0.5 0.01 240)', fontWeight: 400 }}>vs prev</span>
        </div>
      )}

      {/* Bar sparkline */}
      <BarSparkline data={sparkData} color={color} animate />
    </div>
  )
}

// Named export for panes that import both
export { AreaSparkline, BarSparkline }
