/**
 * KPI tile: label, big number, trend delta, and an engaging area-sparkline
 * rendered from REAL data passed via the `sparkData` prop.
 *
 * Speed-v6 visual upgrade:
 *   - Smooth cubic bezier path instead of straight polyline
 *   - Linear-gradient fill below the line (per-color)
 *   - Subtle dot at the latest datapoint
 *   - Hover ring + accent glow on the card
 *   - Stagger entrance via `animate-in fade-in slide-in-from-bottom-2`
 *   - When no data: a gentle placeholder dashed line so the card never feels empty
 */

'use strict'

import React, { useId, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const STROKE = {
  teal:   '#14b8a6',
  sky:    '#0ea5e9',
  coral:  '#f43f5e',
  violet: '#8b5cf6',
  amber:  '#f59e0b',
}

const ICON_TINT = {
  teal:   ['text-teal-500',   'ring-teal-100'],
  sky:    ['text-sky-500',    'ring-sky-100'],
  coral:  ['text-rose-500',   'ring-rose-100'],
  violet: ['text-violet-600', 'ring-violet-100'],
  amber:  ['text-amber-500',  'ring-amber-100'],
}

/**
 * Smooth cubic-bezier SVG path through points using Catmull-Rom-to-Bezier
 * conversion. tension ~0.18 keeps the curve hugging the data without
 * dramatic overshoot.
 */
function smoothPath(points, tension = 0.18) {
  if (points.length < 2) return ''
  const parts = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    parts.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
  }
  return parts.join(' ')
}

function AreaSparkline({ data, color = 'teal', emptyHint }) {
  const id = useId()
  const stroke = STROKE[color] || STROKE.teal
  const W = 140
  const H = 38

  const safe = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []
    return data.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0))
  }, [data])

  if (safe.length < 2) {
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3">
        <line x1="0" y1={H / 2} x2={W} y2={H / 2}
          stroke={stroke} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.25" />
        {emptyHint && (
          <text x={W / 2} y={H / 2 + 4} textAnchor="middle"
            style={{ fontSize: 8, opacity: 0.5, fill: stroke }}>{emptyHint}</text>
        )}
      </svg>
    )
  }

  const max = Math.max(...safe)
  const min = Math.min(...safe)
  const range = max - min || 1
  const step = (W - 4) / (safe.length - 1)
  const pts = safe.map((v, i) => ({
    x: 2 + i * step,
    y: H - 4 - ((v - min) / range) * (H - 10),
  }))

  const path = smoothPath(pts)
  const areaPath = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 overflow-visible">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
          <stop offset="80%" stopColor={stroke} stopOpacity="0.04" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#g-${id})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.25"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last-point "current" dot */}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y}
        r="2.6" fill={stroke} stroke="white" strokeWidth="1.5" />
    </svg>
  )
}

export default function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  Icon,
  emoji,
  sparkData,
  sparkColor = 'teal',
  emptyHint = 'No data yet',
  index = 0,
}) {
  const trendPositive = trend === undefined || trend === null ? null : trend >= 0
  const [iconCls, ringCls] = ICON_TINT[sparkColor] || ICON_TINT.teal
  return (
    <div
      className={cn(
        'group rounded-[20px] bg-white p-[18px] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-all duration-300',
        'hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.14)] hover:-translate-y-0.5',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both'
      )}
      style={{ animationDelay: `${index * 60}ms`, animationDuration: '400ms' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#64756f]">{label}</span>
        {Icon ? (
          <span className={cn('grid h-7 w-7 place-items-center rounded-lg bg-white ring-1 transition-transform group-hover:scale-110', ringCls)}>
            <Icon className={cn('h-3.5 w-3.5', iconCls)} strokeWidth={2.2} />
          </span>
        ) : emoji ? <span>{emoji}</span> : null}
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-none tracking-tight">{value ?? '--'}</div>
      {(trendLabel || trendPositive !== null) && (
        <div
          className={cn(
            'mt-1.5 flex items-center gap-1 text-[11px] font-bold',
            trendPositive === false ? 'text-rose-500' : 'text-teal-600'
          )}
        >
          <TrendingUp className={cn('h-3 w-3', trendPositive === false && 'rotate-180')} />
          {trendLabel ?? `${trendPositive ? '+' : ''}${trend}%`}
        </div>
      )}
      <AreaSparkline data={sparkData} color={sparkColor} emptyHint={emptyHint} />
    </div>
  )
}
