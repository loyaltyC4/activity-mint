/**
 * KPI tile: label, big number, trend delta, optional sparkline.
 * Used in the Pulse pane's top KPI row (4 across).
 */

'use strict'

import React from 'react'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const STROKE = {
  teal:   'stroke-teal-500',
  sky:    'stroke-sky-500',
  coral:  'stroke-rose-500',
  violet: 'stroke-violet-600',
  amber:  'stroke-amber-500',
}

function Sparkline({ data, color = 'teal' }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = 120 / (data.length - 1)
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(30 - ((v - min) / range) * 26 - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg width="100%" height="30" viewBox="0 0 120 30" preserveAspectRatio="none" className="mt-2">
      <polyline
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={STROKE[color] || STROKE.teal}
      />
    </svg>
  )
}

export default function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  emoji,
  sparkData,
  sparkColor = 'teal',
}) {
  const trendPositive = trend === undefined || trend === null ? null : trend >= 0
  return (
    <div className="rounded-[20px] bg-white p-[18px] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#64756f]">{label}</span>
        {emoji && <span>{emoji}</span>}
      </div>
      <div className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight">{value ?? '--'}</div>
      {(trendLabel || trendPositive !== null) && (
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[11px] font-bold',
            trendPositive ? 'text-teal-600' : 'text-rose-500'
          )}
        >
          <TrendingUp className={cn('h-3 w-3', !trendPositive && 'rotate-180')} />
          {trendLabel ?? `${trendPositive ? '+' : ''}${trend}%`}
        </div>
      )}
      {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
    </div>
  )
}
