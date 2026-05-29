/**
 * MetricTile — exact port of insight-flow's MetricTile.tsx (as KpiCard.jsx).
 *
 * Backward-compatible with existing PulsePane props:
 *   sparkColor  → accent   (legacy alias)
 *   sparkData   → sparkline (legacy alias)
 *   trendLabel  → delta    (legacy alias, auto-constructs delta object)
 *   Icon        → icon     (capital-I component class, rendered internally)
 *   trend       → used to infer delta.positive
 */
'use strict'
import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const accentMap = {
  brand:   'var(--brand)',
  violet:  'var(--violet)',
  amber:   'var(--amber)',
  neutral: 'var(--muted-foreground)',
  // legacy aliases
  teal:  'var(--brand)',
  sky:   'var(--violet)',
  coral: 'var(--negative)',
}

export default function KpiCard({
  label,
  value,
  suffix,
  delta,
  sparkline,
  loadingDelay = 0,
  icon,          // ReactNode (already rendered element)
  accent = 'brand',
  className,
  // ── legacy PulsePane aliases ──
  sparkColor,
  sparkData,
  trendLabel,
  Icon: IconComp, // component class (capital-I)
  trend,
  emptyHint,
  loading: loadingProp,
  index,
}) {
  const resolvedAccent = (() => {
    if (accent && accent !== 'brand') return accent
    if (sparkColor) {
      const m = { teal: 'brand', sky: 'violet', coral: 'neutral', violet: 'violet', amber: 'amber' }
      return m[sparkColor] || sparkColor
    }
    return 'brand'
  })()

  const resolvedSparkline = sparkline || sparkData || []

  const resolvedDelta = delta || (trendLabel ? {
    value: trendLabel,
    positive: trend === 'up',
    neutral: !trend || trend === 'neutral',
  } : null)

  const resolvedDelay = loadingProp ? 0 : loadingDelay
  const accentColor = accentMap[resolvedAccent] || accentMap.brand

  const [ready, setReady] = useState(resolvedDelay === 0)
  const [displayValue, setDisplayValue] = useState(ready ? value : '')

  useEffect(() => {
    if (resolvedDelay === 0) { setReady(true); return }
    const t = setTimeout(() => setReady(true), resolvedDelay)
    return () => clearTimeout(t)
  }, [resolvedDelay])

  useEffect(() => {
    if (!ready) return
    if (typeof value === 'number') {
      let raf = 0
      const start = performance.now()
      const dur = 900
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur)
        const eased = 1 - Math.pow(1 - p, 3)
        setDisplayValue(Math.round(value * eased * 100) / 100)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    } else {
      setDisplayValue(value)
    }
  }, [ready, value])

  // Render icon — handles both ReactNode and component class
  const renderIcon = () => {
    if (icon) return icon  // already a rendered element
    if (IconComp) return <IconComp className="size-3.5" strokeWidth={2.25} />
    return null
  }

  return (
    <div className={cn(
      'bg-card rounded-2xl p-5 ring-1 ring-foreground/[0.06] shadow-pane relative overflow-hidden hover:shadow-pop transition-shadow',
      className
    )}>
      {/* Label + icon row */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
        {ready ? (
          renderIcon() ? (
            <div className="size-7 grid place-items-center rounded-md bg-brand-soft text-brand-ink flex-shrink-0">
              {renderIcon()}
            </div>
          ) : null
        ) : (
          <div className="size-7 rounded-md shimmer-surface flex-shrink-0" />
        )}
      </div>

      {ready ? (
        <>
          {/* Value */}
          <div className="font-display font-bold text-3xl tracking-tight leading-none tabular-nums">
            {displayValue}
            {suffix && (
              <span className="text-base font-semibold text-muted-foreground ml-0.5">{suffix}</span>
            )}
          </div>

          {/* Delta */}
          {resolvedDelta && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">
              <span className={
                resolvedDelta.positive ? 'text-positive' :
                resolvedDelta.neutral  ? 'text-muted-foreground' :
                'text-negative'
              }>
                {resolvedDelta.positive && '↗ '}
                {!resolvedDelta.positive && !resolvedDelta.neutral && '↘ '}
                {resolvedDelta.value}
              </span>
              <span className="text-muted-foreground font-normal">vs prev</span>
            </div>
          )}

          {/* Sparkline bars */}
          {resolvedSparkline.length > 0 && (
            <div className="mt-4 h-8 flex items-end gap-0.5">
              {resolvedSparkline.map((v, i) => {
                const pct = typeof v === 'number' && v <= 1 ? v : (v / Math.max(...resolvedSparkline, 1))
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${Math.max(8, pct * 100)}%`,
                      background: i === resolvedSparkline.length - 1
                        ? accentColor
                        : `color-mix(in oklab, ${accentColor} 22%, transparent)`,
                      animation: `bar-fill 0.8s ${i * 40}ms cubic-bezier(0.19,1,0.22,1) both`,
                      transformOrigin: 'bottom',
                    }}
                  />
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* Shimmer */
        <>
          <div className="h-9 w-2/3 rounded shimmer-surface" />
          <div className="mt-1.5 h-3 w-1/2 rounded shimmer-surface opacity-60" />
          <div className="mt-4 h-8 w-full rounded shimmer-surface opacity-40" />
        </>
      )}
    </div>
  )
}
