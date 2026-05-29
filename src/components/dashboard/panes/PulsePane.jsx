/**
 * Pulse — 1:1 port of insight-flow's pulse.tsx
 *
 * Icon swaps to avoid Vite circular chunk conflicts with Sidebar:
 *   Sparkles → Star      (Sparkles is in Sidebar parent chunk)
 *   Users    → UserRound (Users is in Sidebar parent chunk)
 *
 * Fluid loading is preserved by MetricTile's loadingDelay prop:
 *   tile 1: 0ms  · tile 2: 600ms  · tile 3: 1100ms  · tile 4: 1700ms
 * Each tile starts as a shimmer skeleton, then reveals with a count-up
 * animation and bar-fill sparklines that stagger in.
 */
'use strict'

import React from 'react'
import {
  Star, Radio, Heart, Smile, Brain, Plus, ArrowRight, Mic, Eye, UserRound, Clock,
} from 'lucide-react'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import MetricTile from '../shared/KpiCard'
import SectionCard from '../shared/SectionCard'
import RingMeter from '../shared/RingMeter'

export default function PulsePane({ timeRange = '7d' }) {
  const { handle } = useTrackedAccount()
  const displayHandle = handle ? `@${handle}` : 'your connected handles'

  return (
    <>
      {/* Heading */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Daily snapshot
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Live signal from {displayHandle}. Numbers reveal as our orchestrator finishes each pass.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-positive animate-pulse" />
          Streaming · 3 sources
        </div>
      </div>

      {/* KPI row — fluid loading stagger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Mint Score"
          value={88.4}
          delta={{ value: '12.4%', positive: true }}
          sparkline={[0.3, 0.45, 0.4, 0.55, 0.6, 0.78, 0.88]}
          icon={<Star className="size-3.5" strokeWidth={2.25} />}
          accent="brand"
        />
        <MetricTile
          label="Reach"
          value="1.42M"
          delta={{ value: '8.1%', positive: true }}
          sparkline={[0.5, 0.6, 0.55, 0.7, 0.65, 0.85, 0.92]}
          icon={<Radio className="size-3.5" strokeWidth={2.25} />}
          accent="violet"
          loadingDelay={600}
        />
        <MetricTile
          label="Engagement"
          value={4.2}
          suffix="%"
          delta={{ value: '0.6%', positive: true }}
          sparkline={[0.4, 0.5, 0.45, 0.6, 0.55, 0.7, 0.75]}
          icon={<Heart className="size-3.5" strokeWidth={2.25} />}
          accent="amber"
          loadingDelay={1100}
        />
        <MetricTile
          label="Audience mood"
          value="Vibrant"
          delta={{ value: 'Stable', neutral: true }}
          sparkline={[0.6, 0.65, 0.7, 0.65, 0.72, 0.78, 0.8]}
          icon={<Smile className="size-3.5" strokeWidth={2.25} />}
          accent="neutral"
          loadingDelay={1700}
        />
      </div>

      {/* Brand DNA + Offensive Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="Brand DNA"
            subtitle="Deterministic identity extracted from your last 30 posts."
            icon={<Brain className="size-4" strokeWidth={2} />}
            action={
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded bg-positive/10 text-positive">
                Analysis active
              </span>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
              <RingMeter value={88} label="Identity" caption="Confidence" />
              <div className="space-y-4">
                {[
                  { label: 'Voice',           value: 'Authoritative', pct: 88, hint: 'Direct, instructional' },
                  { label: 'Visual style',    value: 'Editorial',     pct: 72, hint: 'High-contrast monochrome' },
                  { label: 'Audience',        value: 'Builders',      pct: 64, hint: 'Tech-curious 25-44' },
                  { label: 'Posting cadence', value: 'High-speed',    pct: 92, hint: '12 / wk · 4.2% ER' },
                ].map((t) => (
                  <div key={t.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                          {t.label}
                        </span>
                        <span className="text-sm font-semibold tracking-tight">{t.value}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                        {t.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-foreground/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full animate-bar-fill"
                        style={{ '--fill-width': `${t.pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{t.hint}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 pt-5 border-t border-hairline flex flex-wrap gap-2">
              {['Editorial', 'Precision', 'Monochrome', 'Technical', 'Builder-led', 'High-velocity'].map((tag, i) => (
                <span
                  key={tag}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                    i === 3
                      ? 'bg-brand-soft text-brand-ink ring-1 ring-brand/20'
                      : 'bg-foreground/[0.04] text-foreground/70'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard tone="ink" padded>
          <div className="absolute -top-16 -right-16 size-56 bg-brand/30 blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="size-9 rounded-lg bg-brand/15 grid place-items-center mb-5">
              <Star className="size-4 text-brand" strokeWidth={2.25} />
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight mb-2 text-white">
              Offensive Pipeline
            </h3>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              Reverse-engineer your rivals&apos; weak points.{' '}
              <span className="text-white/85">Continuous deconstruction</span> runs background loops over their threads.
            </p>
            <ul className="space-y-3 mb-7 text-xs">
              {[
                { label: 'Unlimited AI script generations', on: true },
                { label: 'Priority orchestrator routing',    on: true },
                { label: 'Ad library proxy routines',        on: false },
                { label: '10 client + competitor seats',     on: false },
              ].map((f) => (
                <li key={f.label} className="flex items-center gap-2.5">
                  <div className={`size-1.5 rounded-full ${f.on ? 'bg-brand' : 'bg-white/15'}`} />
                  <span className={f.on ? 'text-white/90 font-medium' : 'text-white/40'}>{f.label}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => (window.location.href = '/#pricing')}
              className="relative w-full py-3 bg-white text-foreground rounded-xl font-semibold text-sm hover:bg-white/95 transition-all flex items-center justify-center gap-2 group"
            >
              Unlock Pipeline Intercept
              <ArrowRight
                className="size-4 group-hover:translate-x-0.5 transition-transform"
                strokeWidth={2.25}
              />
            </button>
            <p className="text-[10px] text-white/40 text-center mt-2.5 font-mono uppercase tracking-[0.15em]">
              $149 / month · cancel anytime
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Stories + Recent posts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard
          title="Active stories"
          subtitle="Live feed across your connected handles"
          icon={<Eye className="size-4" strokeWidth={2} />}
          action={
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-brand hover:underline cursor-pointer">
              View all
            </span>
          }
        >
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {['Mon', 'Tue', 'Wed'].map((day, i) => (
              <div
                key={i}
                className="aspect-[9/14] rounded-xl ring-1 ring-foreground/[0.05] bg-gradient-to-br from-brand/10 via-violet/10 to-amber/10 relative overflow-hidden"
              >
                <div className="absolute inset-0.5 rounded-[10px] bg-card/40 backdrop-blur-sm" />
                <div className="absolute bottom-2 left-2 right-2 text-[9px] font-mono uppercase tracking-widest text-foreground/60">
                  {day}
                </div>
              </div>
            ))}
            <button
              aria-label="Add story"
              className="aspect-[9/14] rounded-xl border-2 border-dashed border-hairline grid place-items-center text-muted-foreground hover:border-brand hover:text-brand transition-colors group"
            >
              <div className="flex flex-col items-center gap-1.5">
                <div className="size-7 rounded-full bg-foreground/[0.04] grid place-items-center group-hover:bg-brand-soft transition-colors">
                  <Plus className="size-3.5" strokeWidth={2.25} />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-widest">Add</span>
              </div>
            </button>
          </div>
        </SectionCard>

        <div className="lg:col-span-2">
          <SectionCard
            title="Recent posts"
            subtitle="Best-performing content this week"
            icon={<Mic className="size-4" strokeWidth={2} />}
            action={
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-brand hover:underline cursor-pointer">
                Open feed →
              </span>
            }
          >
            <div className="space-y-2.5">
              {[
                { title: 'How we shipped 12 reels in a single weekend', er: '6.8%', views: '184K', time: '2h', trend: '+44%' },
                { title: 'The 3-frame opener that doubled saves',         er: '5.4%', views: '126K', time: '1d', trend: '+22%' },
                { title: 'Behind the scenes: workflow architecture',      er: '4.1%', views: '94K',  time: '2d', trend: '+9%'  },
                { title: 'Why we removed every emoji from our captions',  er: '3.7%', views: '71K',  time: '4d', trend: '−3%'  },
              ].map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors group cursor-pointer"
                >
                  <div className="size-12 rounded-lg bg-gradient-to-br from-foreground/90 via-brand-ink to-brand relative overflow-hidden shrink-0">
                    <div className="absolute bottom-1 right-1 text-[9px] font-mono text-white/80 font-bold">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold tracking-tight truncate group-hover:text-brand-ink transition-colors">
                      {p.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span><UserRound className="inline size-3 -mt-0.5" strokeWidth={2} /> {p.views}</span>
                      <span>ER {p.er}</span>
                      <span><Clock className="inline size-3 -mt-0.5" strokeWidth={2} /> {p.time}</span>
                    </div>
                  </div>
                  <div className={`text-xs font-bold tabular-nums ${p.trend.startsWith('−') ? 'text-negative' : 'text-positive'}`}>
                    {p.trend}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
