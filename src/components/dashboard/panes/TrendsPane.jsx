/**
 * Trends & Insights — 1:1 port of insight-flow's trends.tsx
 * Icon swaps: TrendingUp → ArrowUpRight, Sparkles → Wand2
 */
'use strict'

import React from 'react'
import { Hash, Music2, Flame, ArrowUpRight, Plus, Wand2, Clock } from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const trends = [
  { tag: 'founder-led ads',     heat: 96, lift: '+312%', window: '48h', category: 'Format', note: 'Talking-head ads outperforming polished UGC by 3.4×' },
  { tag: 'no-music reels',      heat: 88, lift: '+184%', window: '7d',  category: 'Format', note: 'Silence-first reels gaining saves in finance & B2B' },
  { tag: 'stat-shock carousel', heat: 81, lift: '+121%', window: '7d',  category: 'Format', note: 'Single-number cover slides driving 4× save rate' },
  { tag: 'vertical livestream', heat: 74, lift: '+88%',  window: '30d', category: 'Surface', note: 'IG Live with sub-200 viewers converting to DMs at 14%' },
  { tag: 'POV teardown',        heat: 62, lift: '+44%',  window: '7d',  category: 'Hook',   note: '"POV: you just realized…" openers indexing in tech niche' },
]

const sounds = [
  { name: 'Linger — Forrest Frank',  uses: '1.2M', trend: '↑ early',   peak: 'in 4d' },
  { name: 'Skyfall (Sped-up)',        uses: '842K', trend: '↑ rising',  peak: 'in 9d' },
  { name: 'Espresso — Sabrina',       uses: '3.4M', trend: '→ plateau', peak: 'passed' },
]

const hashtagCluster = [
  { t: '#foundermode', w: 96 }, { t: '#offercreation', w: 88 }, { t: '#copywriting', w: 82 },
  { t: '#bootstrap', w: 74 },   { t: '#leverage', w: 68 },     { t: '#oneman', w: 64 },
  { t: '#niche', w: 58 },        { t: '#cashflow', w: 52 },     { t: '#productled', w: 48 },
  { t: '#dms', w: 44 },          { t: '#nopolish', w: 38 },
]

export default function TrendsPane() {
  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Trends &amp; Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Heat-scored signals from your category, scored continuously and ranked by save-velocity, not view counts.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
          <Wand2 className="size-3.5" strokeWidth={2.25} /> Generate trend brief
        </button>
      </div>

      <SectionCard
        title="Heat-ranked formats"
        subtitle="Last 7 days · indexed against your historical baseline"
        icon={<Flame className="size-4" strokeWidth={2} />}
      >
        <div className="space-y-2">
          {trends.map((t, i) => (
            <div
              key={t.tag}
              className="group flex items-center gap-4 p-3 rounded-xl hover:bg-foreground/[0.03] transition-all animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="w-10 text-center">
                <div className="text-[10px] font-mono font-bold tabular-nums text-muted-foreground">
                  #{String(i + 1).padStart(2, '0')}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-display font-semibold tracking-tight">{t.tag}</span>
                  <span className="text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-foreground/[0.05] text-muted-foreground">
                    {t.category}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.note}</div>
                <div className="mt-2 h-1.5 bg-foreground/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full animate-bar-fill bg-gradient-to-r from-brand to-amber"
                    style={{ '--fill-width': `${t.heat}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <div className="text-sm font-bold text-positive tabular-nums">{t.lift}</div>
                <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="size-2.5" /> {t.window}
                </div>
              </div>
              <button className="px-3 py-1.5 rounded-md bg-foreground text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand hover:text-foreground flex items-center gap-1">
                <Plus className="size-3" strokeWidth={2.5} /> Use
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Sound radar"
          subtitle="Sounds trending in your category"
          icon={<Music2 className="size-4" strokeWidth={2} />}
        >
          <div className="space-y-2.5">
            {sounds.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-foreground/[0.05] bg-surface-2/50 hover:bg-card transition-colors group"
              >
                <div className="size-10 rounded-lg bg-gradient-to-br from-violet/30 to-brand/30 grid place-items-center shrink-0">
                  <Music2 className="size-4 text-foreground" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold tracking-tight truncate">{s.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground flex gap-3 mt-0.5">
                    <span>{s.uses} uses</span>
                    <span className="text-brand-ink">{s.trend}</span>
                    <span>Peak {s.peak}</span>
                  </div>
                </div>
                <button
                  aria-label="Open sound"
                  className="opacity-0 group-hover:opacity-100 transition-opacity size-8 rounded-lg bg-foreground text-white grid place-items-center"
                >
                  <ArrowUpRight className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Hashtag clusters"
          subtitle="Co-occurring tags driving discovery"
          icon={<Hash className="size-4" strokeWidth={2} />}
        >
          <div className="flex flex-wrap gap-2">
            {hashtagCluster.map((h) => (
              <button
                key={h.t}
                className="px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-foreground/[0.08] hover:ring-brand hover:bg-brand-soft transition-all tabular-nums"
                style={{ fontSize: `${10 + h.w / 18}px` }}
              >
                {h.t}{' '}
                <span className="text-[9px] text-muted-foreground font-mono ml-1">{h.w}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-hairline">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
              Suggested cluster for you
            </div>
            <div className="text-xs leading-relaxed">
              <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand-ink font-semibold mr-1">#foundermode</span>
              <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand-ink font-semibold mr-1">#offercreation</span>
              <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand-ink font-semibold mr-1">#leverage</span>
              <span className="text-muted-foreground">+ 4 niche tags</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard tone="ink">
        <div className="absolute -top-12 -right-12 size-56 bg-brand/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="size-4 text-brand" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand">Predictive lift</span>
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight text-white">
              Riding &quot;founder-led ads&quot; this week could lift your reach by{' '}
              <span className="text-brand">+184%</span>
            </h3>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Based on the cohort of 1,200+ creators in your category who have already adopted the format.
            </p>
          </div>
          <button className="shrink-0 px-5 py-3 bg-brand text-foreground rounded-xl font-semibold text-sm hover:bg-brand/90 transition-all flex items-center gap-2">
            Draft a founder-led reel <ArrowUpRight className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      </SectionCard>
    </>
  )
}
