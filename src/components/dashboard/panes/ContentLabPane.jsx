/**
 * Content Lab — 1:1 port of insight-flow's content-lab.tsx
 * Static demo data shown until real data wiring lands. Identical visual.
 */
'use strict'

import React from 'react'
import {
  Play, Eye, Heart, Bookmark, ArrowRight, Sparkles,
  Hash, Clock, Layers, FileCode, Camera, Music2, Type, Wand2, Copy, Download,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'

// ── Demo data (identical to insight-flow/src/routes/content-lab.tsx) ──
const heroPosts = [
  { id: 1, handle: '@hormozi', title: 'The $100M offer breakdown', er: '9.4%', views: '2.4M', saves: '184K', format: 'Reel · 47s', trend: '+412%' },
  { id: 2, handle: '@chrisdo', title: 'Design like you mean it',   er: '7.1%', views: '684K', saves: '92K',  format: 'Carousel · 9', trend: '+88%'  },
  { id: 3, handle: '@garyvee', title: "Document, don't create",    er: '6.2%', views: '1.1M', saves: '44K',  format: 'Reel · 21s',  trend: '+54%'  },
]

const frames = [
  { t: '00:00', role: 'Hook',    note: 'Direct-to-camera. Bold claim. No music yet.',           weight: 92 },
  { t: '00:03', role: 'Tension', note: 'Reframes the claim into a contrarian question.',        weight: 78 },
  { t: '00:08', role: 'Proof',   note: 'Cuts to overlay graphic with one stat.',                weight: 84 },
  { t: '00:14', role: 'Method',  note: 'Three rapid B-roll cuts demonstrating process.',         weight: 70 },
  { t: '00:28', role: 'Payoff',  note: 'Returns to talking head. Sharp single-line CTA.',       weight: 88 },
]

const ingredients = [
  { Icon: Camera,   label: 'Shot list',       value: '5 cuts · 1 talking head, 3 B-roll, 1 overlay' },
  { Icon: Music2,   label: 'Sound',           value: 'Trending sound — "Linger" by Forrest Frank' },
  { Icon: Type,     label: 'On-screen text',  value: '3 captions · 28-32px · top-thirds anchored' },
  { Icon: Clock,    label: 'Pacing',          value: 'Avg cut every 4.6s · hook held for 3s' },
  { Icon: Hash,     label: 'Hashtags',        value: '#offer #copywriting #foundermode + 4 niche' },
  { Icon: FileCode, label: 'Caption frame',   value: 'Hook · Story · Lesson · CTA (Hormozi P-S-O)' },
]

function Stat({ Icon, v }) {
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <Icon className="size-3" strokeWidth={2} />
      <span className="tabular-nums">{v}</span>
    </div>
  )
}

export default function ContentLabPane() {
  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">Content Lab</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Pick any top post. Pulse breaks it into frames, ingredients, and a replicable framework — then ships it to Script Studio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 bg-foreground/[0.04] rounded-lg ring-1 ring-foreground/5">
            {['Reels', 'Carousels', 'Photos'].map((t, i) => (
              <button
                key={t}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                  i === 0 ? 'bg-card text-foreground shadow-pane' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
            <Wand2 className="size-3.5" strokeWidth={2.25} /> Deconstruct URL
          </button>
        </div>
      </div>

      {/* Top performing posts */}
      <SectionCard
        title="Top-decile posts this week"
        subtitle="Ranked by save-velocity across your tracked competitors"
        icon={<Layers className="size-4" strokeWidth={2} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {heroPosts.map((p, i) => (
            <div
              key={p.id}
              className={`relative p-4 rounded-xl ring-1 transition-all cursor-pointer ${
                i === 0
                  ? 'ring-brand/40 bg-brand-soft/40'
                  : 'ring-foreground/[0.06] bg-surface-2/60 hover:bg-card hover:shadow-pop'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{p.format}</span>
                <span className="text-[10px] font-bold tabular-nums text-positive bg-positive/10 px-1.5 py-0.5 rounded">{p.trend}</span>
              </div>
              <div className="aspect-[4/5] rounded-lg bg-gradient-to-br from-foreground via-brand-ink to-brand relative overflow-hidden mb-3">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="size-10 rounded-full bg-white/10 backdrop-blur grid place-items-center">
                    <Play className="size-4 text-white fill-white" />
                  </div>
                </div>
                {i === 0 && (
                  <div className="absolute top-2 left-2 text-[9px] font-bold bg-brand text-foreground px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                    Analyzing
                  </div>
                )}
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-1">{p.handle}</div>
              <div className="text-sm font-semibold tracking-tight leading-snug mb-3">{p.title}</div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                <Stat Icon={Eye} v={p.views} />
                <Stat Icon={Heart} v={p.er} />
                <Stat Icon={Bookmark} v={p.saves} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Frame breakdown + Ingredients */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Frame breakdown */}
        <div className="lg:col-span-3">
          <SectionCard
            title="Frame breakdown"
            subtitle="@hormozi — The $100M offer breakdown"
            icon={<Play className="size-4" strokeWidth={2} />}
            action={
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand-ink bg-brand-soft px-2 py-1 rounded">
                47s · 5 beats
              </span>
            }
          >
            <div className="space-y-2.5">
              {frames.map((f, i) => (
                <div
                  key={i}
                  className="group flex items-stretch gap-3 p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors"
                >
                  <div className="w-12 shrink-0 flex flex-col items-center pt-1">
                    <div className="text-[10px] font-mono font-bold tabular-nums text-foreground">{f.t}</div>
                    <div className="flex-1 w-px bg-hairline mt-1.5 group-hover:bg-brand transition-colors" />
                  </div>
                  <div className="aspect-square w-14 rounded-lg shrink-0 bg-gradient-to-br from-foreground/90 to-brand-ink relative overflow-hidden">
                    <div className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold text-white/70">F{i + 1}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-display font-semibold tracking-tight">{f.role}</div>
                      <div className="text-[10px] font-mono text-muted-foreground tabular-nums">weight {f.weight}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.note}</div>
                    <div className="mt-2 h-1 bg-foreground/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand rounded-full"
                        style={{
                          width: `${f.weight}%`,
                          transition: 'width 1.2s cubic-bezier(0.19,1,0.22,1)',
                        }}
                      />
                    </div>
                  </div>
                  <button className="self-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono uppercase tracking-wider text-brand-ink hover:text-brand">
                    Replicate →
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Ingredients + Ship to Script Studio */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Ingredient list"
            subtitle="Everything you need to reproduce it"
            icon={<Sparkles className="size-4" strokeWidth={2} />}
          >
            <ul className="space-y-3">
              {ingredients.map((ing) => {
                const Icon = ing.Icon
                return (
                  <li key={ing.label} className="flex items-start gap-3 group">
                    <div className="size-8 rounded-lg bg-foreground/[0.04] grid place-items-center shrink-0 group-hover:bg-brand-soft transition-colors">
                      <Icon
                        className="size-3.5 text-foreground/70 group-hover:text-brand-ink"
                        strokeWidth={2}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{ing.label}</div>
                      <div className="text-xs font-medium leading-snug mt-0.5">{ing.value}</div>
                    </div>
                    <button
                      aria-label={`Copy ${ing.label}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity size-6 rounded grid place-items-center hover:bg-foreground/[0.05]"
                    >
                      <Copy className="size-3 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          <SectionCard tone="ink">
            <div className="absolute -bottom-16 -right-12 size-48 bg-brand/30 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <h3 className="font-display font-bold text-xl tracking-tight leading-tight mb-2 text-white">
                Ship to Script Studio
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-5">
                Send this exact framework into an editable script with your handle's voice already applied.
              </p>
              <div className="space-y-2">
                <button className="w-full py-2.5 bg-brand text-foreground rounded-lg font-semibold text-xs hover:bg-brand/90 transition-all flex items-center justify-center gap-2 group">
                  Replicate in Script Studio
                  <ArrowRight
                    className="size-3.5 group-hover:translate-x-0.5 transition-transform"
                    strokeWidth={2.25}
                  />
                </button>
                <button className="w-full py-2.5 bg-white/5 ring-1 ring-white/10 text-white rounded-lg font-medium text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <Download className="size-3.5" strokeWidth={2} /> Export brief (PDF)
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
