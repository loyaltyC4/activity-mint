/**
 * Template Studio — 1:1 port of insight-flow's templates.tsx
 * Icon swap: FileText → Files
 */
'use strict'

import React from 'react'
import { Files, Layers, Image as ImageIcon, Video, ArrowRight, Plus } from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const presets = [
  {
    title: 'Stat Shock Carousel',
    kind:  'Carousel · 8 slides',
    icon:  Layers,
    color: 'brand',
    body:  'Open with a shocking statistic, break it down across 6 value slides, close with CTA. High-contrast dark background, bold white numbers.',
    cite:  'PostEverywhere Feb 2026 · 8-10 slides push ER past 2%. Hormozi: hook with a number that creates cognitive dissonance.',
  },
  {
    title: 'Chris Do Typography Post',
    kind:  'Photo · 1 slide',
    icon:  ImageIcon,
    color: 'violet',
    body:  'Single-image post with one bold contrarian statement on a pure black or white background. Typography IS the content.',
    cite:  'The Futur / Chris Do: "The headline must compel the viewer to dig deeper."',
  },
  {
    title: 'Behind The Scenes Reel',
    kind:  'Reel · Script',
    icon:  Video,
    color: 'amber',
    body:  'Script structure for a 15-25 second BTS reel. Hook (selfie), process (action shots), result (reveal).',
    cite:  'Gary Vaynerchuk: "Document, don\'t create." Hormozi: Hook captures, Retain shows value, Reward delivers payoff.',
  },
  {
    title: 'Value Ladder Carousel',
    kind:  'Carousel · 6 slides',
    icon:  Layers,
    color: 'brand',
    body:  'Walk the viewer from problem awareness to your offer. Slides 1-2 prime, 3-5 educate, 6 converts.',
    cite:  'Russell Brunson, DotCom Secrets — the soap opera sequence ported to social.',
  },
  {
    title: 'Before / After Carousel',
    kind:  'Carousel · 5 slides',
    icon:  Layers,
    color: 'violet',
    body:  'High-contrast transformation reveal. Cover before, three steps, dramatic after. Works for design, fitness, code refactors.',
    cite:  'Top 1% of saves on IG carousels Q4 2025 came from B/A formats — Later analytics.',
  },
  {
    title: 'Hormozi Question Carousel',
    kind:  'Carousel · 7 slides',
    icon:  Layers,
    color: 'amber',
    body:  'Open with the audience\'s biggest objection as a question, then dismantle it across 5 slides, close with the offer.',
    cite:  '$100M Leads, Ch. 4: "Answer the unspoken objection before they say it."',
  },
]

const colorMap = {
  brand:  { ring: 'ring-brand/20',  bg: 'bg-brand-soft',  text: 'text-brand-ink' },
  violet: { ring: 'ring-violet/20', bg: 'bg-violet/10',   text: 'text-violet' },
  amber:  { ring: 'ring-amber/20',  bg: 'bg-amber/10',    text: 'text-amber' },
}

const savedHandles = ['@claudeai', '@claudeai', '@claudeai', '@moretolife.au']

export default function TemplateStudioPane() {
  return (
    <>
      <div>
        <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
          Template Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          Choose a proven content template backed by real engagement data — every preset cites its source.
        </p>
      </div>

      <SectionCard
        title="Your saved templates"
        subtitle="Generated from your top-performing posts"
        icon={<Files className="size-4" strokeWidth={2} />}
        action={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
            <Plus className="size-3.5" strokeWidth={2.25} /> New from post
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedHandles.map((h, i) => (
            <div
              key={i}
              className="p-5 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/60 hover:bg-card hover:shadow-pop transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-1 w-12 bg-foreground rounded-full" />
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet/10 text-violet">
                  From post
                </span>
              </div>
              <div className="font-display font-semibold tracking-tight text-base">{h} post</div>
              <div className="text-xs text-muted-foreground mt-1">Custom template from your analysis</div>
              <div className="mt-4 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                Based on {h} top post
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-4">
          Research-backed presets
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {presets.map((p) => {
            const Icon = p.icon
            const c = colorMap[p.color]
            return (
              <div
                key={p.title}
                className="bg-card rounded-2xl ring-1 ring-foreground/[0.06] shadow-pane overflow-hidden flex flex-col group hover:shadow-pop transition-all"
              >
                <div className="h-32 relative overflow-hidden bg-foreground">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand/30 via-transparent to-violet/20 opacity-80" />
                  <div className="absolute inset-0 grid place-items-center">
                    <div className={`size-12 rounded-xl ${c.bg} ${c.ring} ring-1 grid place-items-center backdrop-blur-sm`}>
                      <Icon className={`size-5 ${c.text}`} strokeWidth={2} />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-4 text-[10px] font-mono uppercase tracking-[0.15em] text-white/70">
                    {p.kind}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-display font-bold text-base tracking-tight">{p.title}</h3>
                  <p className="text-sm text-foreground/70 mt-2 leading-relaxed">{p.body}</p>
                  <p className="text-[11px] italic text-muted-foreground mt-3 leading-relaxed">{p.cite}</p>
                  <button className="mt-5 w-full py-2.5 bg-foreground text-white rounded-lg font-semibold text-xs hover:bg-brand hover:text-foreground transition-all flex items-center justify-center gap-1.5 group/btn">
                    Use template
                    <ArrowRight className="size-3.5 group-hover/btn:translate-x-0.5 transition-transform" strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
