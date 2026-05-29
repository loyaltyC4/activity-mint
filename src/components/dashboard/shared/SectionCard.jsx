/**
 * SectionCard — exact port of insight-flow's SectionCard.tsx
 * tone="default" → white card   |   tone="ink" → dark foreground card with glow
 */
'use strict'
import React from 'react'
import { cn } from '@/lib/utils'

export default function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  padded = true,
  tone = 'default',
  className,
}) {
  const isInk = tone === 'ink'

  return (
    <section className={cn(
      'rounded-2xl relative overflow-hidden',
      isInk
        ? 'bg-foreground text-white ring-1 ring-white/5'
        : 'bg-card ring-1 ring-foreground/[0.06]',
      'shadow-pane',
      padded ? 'p-6 lg:p-7' : '',
      className,
    )}>
      {(title || icon || action) && (
        <header className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className={cn(
                'size-9 shrink-0 grid place-items-center rounded-lg',
                isInk ? 'bg-white/10 text-brand' : 'bg-brand-soft text-brand-ink',
              )}>
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className={cn(
                  'font-display font-semibold tracking-tight text-base',
                  isInk ? 'text-white' : '',
                )}>{title}</h3>
              )}
              {subtitle && (
                <p className={cn(
                  'text-xs mt-0.5',
                  isInk ? 'text-white/60' : 'text-muted-foreground',
                )}>{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
