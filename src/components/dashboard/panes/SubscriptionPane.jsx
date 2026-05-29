/**
 * Subscription — 1:1 port of insight-flow's pricing.tsx, reframed for the
 * in-app subscription surface. Shows the user's current plan and lets them
 * upgrade without leaving the dashboard.
 *
 * Icon swap to avoid Vite chunk collision: Sparkles (sidebar) → Crown.
 */
'use strict'

import React from 'react'
import { Check, Crown, ArrowRight, BadgeCheck } from 'lucide-react'
import SectionCard from '../shared/SectionCard'
import { useTier } from '../../../context/TierContext'

const tiers = [
  {
    key: 'free',
    name: 'Freemium Hook',
    tag: 'Token-bounded',
    price: '$0',
    period: 'forever',
    blurb: 'Instant baseline audit for casual creators.',
    cta: 'Current plan',
    ctaStyle: 'outline',
    features: [
      '1 connected Instagram handle',
      '7-day historic data window',
      'Basic sentiment score (Pulse overview)',
      '3-post analytics cap per scan',
    ],
    locked: ['AI slide generation', 'Competitor Ad Intelligence'],
  },
  {
    key: 'standard',
    name: 'Solo Hunter',
    tag: 'Most popular',
    price: '$39',
    period: '/ month',
    blurb: 'Out-produce your competition with programmatic templates.',
    cta: 'Upgrade to Solo',
    ctaStyle: 'primary',
    highlighted: true,
    features: [
      '3 active tracked accounts',
      '30-day deep data window',
      'Full Content Lab & Script Studio',
      '50 AI script generations / mo (Haiku 4.5)',
      '10 automated AI carousels / mo',
    ],
    locked: [],
  },
  {
    key: 'premium',
    name: 'Pipeline Intercept',
    tag: 'Power',
    price: '$149',
    period: '/ month',
    blurb: "Reverse-engineer your rivals' weak points. Steal market share.",
    cta: 'Go Power',
    ctaStyle: 'ink',
    features: [
      '10 active tracked accounts',
      '90-day deep historical window',
      'Offensive Pipeline Interception tools',
      '15 competitor Ad Library searches / mo',
      'Unlimited AI script generations',
      'Priority orchestrator routing',
    ],
    locked: [],
  },
]

function tierKeyFromContext(tier) {
  if (tier === 'premium')  return 'premium'
  if (tier === 'standard') return 'standard'
  return 'free'
}

export default function SubscriptionPane() {
  const { tier } = useTier()
  const currentKey = tierKeyFromContext(tier)
  const currentTier = tiers.find((t) => t.key === currentKey) || tiers[0]

  return (
    <>
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto pt-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-ink text-[11px] font-mono uppercase tracking-[0.15em] mb-5">
          <Crown className="size-3" strokeWidth={2.25} /> Subscription
        </div>
        <h1 className="font-display font-bold text-5xl tracking-tight leading-[1] mb-4">
          Scale your influence with precision.
        </h1>
        <p className="text-base text-muted-foreground max-w-prose mx-auto">
          Three tiers, one orchestrator. Upgrade unlocks more lanes — competitor intelligence, deeper history, faster routing.
        </p>
      </div>

      {/* Current plan summary */}
      <SectionCard
        title={`You're on ${currentTier.name}`}
        subtitle={currentKey === 'free'
          ? "Free forever — upgrade any time, cancel any time."
          : `${currentTier.price}${currentTier.period} · renews monthly`}
        icon={<BadgeCheck className="size-4" strokeWidth={2} />}
        action={
          currentKey !== 'premium' ? (
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-positive bg-positive/10 px-2 py-1 rounded">
              Active
            </span>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand-ink bg-brand-soft px-2 py-1 rounded">
              Power tier
            </span>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {currentTier.features.slice(0, 3).map((f) => (
            <div key={f} className="p-3 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/60 flex items-start gap-2">
              <div className="size-5 rounded-full bg-brand-soft grid place-items-center mt-0.5 shrink-0">
                <Check className="size-2.5 text-brand-ink" strokeWidth={3} />
              </div>
              <span className="text-sm text-foreground/85 leading-relaxed">{f}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Pricing grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        {tiers.map((t) => {
          const isHi = t.highlighted
          const isCurrent = t.key === currentKey
          const cta = isCurrent ? 'Current plan' : t.cta
          const ctaStyle = isCurrent ? 'outline' : t.ctaStyle
          return (
            <div
              key={t.name}
              className={`relative rounded-2xl p-7 flex flex-col ${
                isCurrent
                  ? 'bg-card ring-2 ring-positive shadow-pane'
                  : isHi
                  ? 'bg-card ring-2 ring-brand shadow-glow'
                  : 'bg-card ring-1 ring-foreground/[0.06] shadow-pane'
              }`}
            >
              {isHi && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand text-foreground rounded-full text-[10px] font-bold uppercase tracking-[0.15em]">
                  {t.tag}
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-positive text-white rounded-full text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1">
                  <BadgeCheck className="size-3" /> You're here
                </div>
              )}

              <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                {t.tag}
              </div>
              <h3 className="font-display font-bold text-2xl tracking-tight">{t.name}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 mb-5 min-h-[40px]">{t.blurb}</p>

              <div className="flex items-baseline gap-1.5 mb-6 pb-6 border-b border-hairline">
                <span className="font-display font-bold text-5xl tracking-tighter">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <div className="size-4 rounded-full bg-brand-soft grid place-items-center mt-0.5 shrink-0">
                      <Check className="size-2.5 text-brand-ink" strokeWidth={3} />
                    </div>
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
                {t.locked.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm opacity-40">
                    <div className="size-4 rounded-full ring-1 ring-foreground/15 mt-0.5 shrink-0" />
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 group ${
                  ctaStyle === 'primary'
                    ? 'bg-brand text-foreground hover:brightness-105'
                    : ctaStyle === 'ink'
                    ? 'bg-foreground text-white hover:bg-foreground/90'
                    : 'ring-1 ring-foreground/15 text-foreground hover:bg-foreground/[0.04] disabled:opacity-60 disabled:hover:bg-transparent disabled:cursor-default'
                }`}
              >
                {cta}
                {ctaStyle !== 'outline' && (
                  <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.25} />
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="text-center text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground pt-4">
        Cancel anytime · Annual saves 20% · No card to start
      </div>

      {/* FAQ-style strip */}
      <SectionCard tone="ink">
        <div className="absolute -top-12 -right-12 size-56 bg-brand/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { q: 'Can I switch plans?',  a: 'Up or down, any time. Mid-cycle changes are prorated automatically.' },
            { q: 'What about cancellation?', a: 'One click. Your tracked data stays for 30 days in case you reactivate.' },
            { q: 'Do annual discounts stack?', a: 'Annual saves 20% across every tier. No promo code needed.' },
          ].map((f) => (
            <div key={f.q}>
              <div className="font-display font-semibold text-base tracking-tight text-white mb-1">
                {f.q}
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  )
}
