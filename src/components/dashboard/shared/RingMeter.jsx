/**
 * RingMeter — exact port of insight-flow's RingMeter.tsx
 * SVG circular progress ring with animated stroke-dashoffset.
 */
'use strict'
import React, { useEffect, useState } from 'react'

export default function RingMeter({
  value,
  size = 140,
  label,
  caption,
  color = 'var(--brand)',
}) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const [v, setV] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setV(value), 100)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="var(--hairline)" strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke}
          fill="none" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.19, 1, 0.22, 1)' }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display font-bold text-2xl tracking-tight tabular-nums">
            {Math.round(v)}
          </div>
          {label && (
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mt-1">
              {label}
            </div>
          )}
          {caption && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {caption}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
