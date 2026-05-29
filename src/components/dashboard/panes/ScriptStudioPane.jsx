/**
 * Script Studio — 1:1 port of insight-flow's script-studio.tsx
 *
 * Icon swaps to avoid Vite circular chunk conflicts with Sidebar:
 *   FileCode → BookOpen      (FileCode is in Sidebar parent chunk)
 *   Sparkles → Wand2         (Sparkles is in Sidebar parent chunk)
 *
 * Fluid loading: framework cards stagger fade-up, beats reveal sequentially,
 * shot list items animate in via animate-fade-up.
 */
'use strict'

import React, { useState } from 'react'
import {
  BookOpen, Wand2, Mic, Clipboard, Download, RefreshCw, Play,
  ChevronRight, Check, Camera, Type, Music2,
} from 'lucide-react'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import SectionCard from '../shared/SectionCard'

const frameworks = [
  { id: 'ahp', label: 'Hook · Story · Lesson · CTA',           source: 'Hormozi',         duration: '30-60s' },
  { id: 'vph', label: 'Problem · Promise · Proof · Pivot',     source: 'Russell Brunson', duration: '45-90s' },
  { id: 'btr', label: 'Before · Transformation · Reveal',      source: 'TikTok native',   duration: '15-30s' },
  { id: 'doc', label: "Document · Don't Create",                source: 'Gary Vee',        duration: '15-45s' },
]

const beats = [
  { t: '00:00 – 00:03', label: 'Hook',   text: "I made $14k in 7 days selling a $9 PDF. Here's the exact funnel.",                  state: 'ready'    },
  { t: '00:03 – 00:09', label: 'Setup',  text: "Most creators skip this one thing — and it's why their offers die in the DMs.",   state: 'ready'    },
  { t: '00:09 – 00:22', label: 'Method', text: '1. One painful problem. 2. One precise promise. 3. One easy ask. Show the screen recording of the checkout.', state: 'ready' },
  { t: '00:22 – 00:34', label: 'Proof',  text: 'Overlay the Stripe receipts. Cut to a customer DM screenshot.',                    state: 'drafting' },
  { t: '00:34 – 00:42', label: 'CTA',    text: "Comment OFFER and I'll send you the exact template I used.",                       state: 'ready'    },
]

export default function ScriptStudioPane({ timeRange = '7d' }) {
  const [active, setActive] = useState('ahp')
  const { handle } = useTrackedAccount()
  const displayHandle = handle ? `@${handle}` : '@moretolife.au'

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Script Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Pick a framework. Drop in a topic. Pulse drafts beat-by-beat with shot direction,
            on-screen text, and timing — calibrated to your handle&apos;s voice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-foreground/10 text-xs font-medium hover:bg-foreground/[0.04] transition-colors">
            <Mic className="size-3.5" strokeWidth={2} /> Voice match:{' '}
            <span className="text-brand-ink font-semibold">{displayHandle}</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
            <Wand2 className="size-3.5" strokeWidth={2.25} /> New script
          </button>
        </div>
      </div>

      {/* Framework picker */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {frameworks.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setActive(f.id)}
            className={`p-4 rounded-xl ring-1 text-left transition-all animate-fade-up ${
              active === f.id
                ? 'ring-brand bg-brand-soft/50 shadow-pop'
                : 'ring-foreground/[0.06] bg-card hover:ring-foreground/15'
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                {f.source}
              </span>
              {active === f.id && (
                <div className="size-4 rounded-full bg-brand grid place-items-center">
                  <Check className="size-2.5 text-foreground" strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="text-sm font-display font-semibold tracking-tight leading-snug">
              {f.label}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground mt-2">
              Best for {f.duration}
            </div>
          </button>
        ))}
      </div>

      {/* Beat editor + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SectionCard
            title="Script · The $9 PDF funnel"
            subtitle="42s · 5 beats · ready to record"
            icon={<BookOpen className="size-4" strokeWidth={2} />}
            action={
              <div className="flex items-center gap-1.5">
                <button
                  aria-label="Regenerate"
                  className="size-7 grid place-items-center rounded-md hover:bg-foreground/[0.05]"
                >
                  <RefreshCw className="size-3.5 text-muted-foreground" strokeWidth={2} />
                </button>
                <button
                  aria-label="Copy script"
                  className="size-7 grid place-items-center rounded-md hover:bg-foreground/[0.05]"
                >
                  <Clipboard className="size-3.5 text-muted-foreground" strokeWidth={2} />
                </button>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-brand text-foreground text-[11px] font-semibold hover:bg-brand/90 transition-all">
                  <Play className="size-3 fill-current" strokeWidth={2} /> Teleprompt
                </button>
              </div>
            }
          >
            <div className="space-y-2">
              {beats.map((b, i) => (
                <div
                  key={i}
                  className="group p-4 rounded-xl ring-1 ring-foreground/[0.05] bg-surface-2/50 hover:bg-card hover:shadow-pane transition-all animate-fade-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded bg-foreground text-white">
                        {b.label.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                        {b.t}
                      </span>
                      {b.state === 'drafting' && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-amber bg-amber/10 px-1.5 py-0.5 rounded animate-pulse">
                          Drafting
                        </span>
                      )}
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono uppercase tracking-wider text-brand-ink hover:text-brand">
                      Regenerate →
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{b.text}</p>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-hairline text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Camera className="size-3" strokeWidth={2} /> Talking head
                    </span>
                    <span className="flex items-center gap-1">
                      <Type className="size-3" strokeWidth={2} /> 2 captions
                    </span>
                    <span className="flex items-center gap-1">
                      <Music2 className="size-3" strokeWidth={2} /> Trending
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Voice calibration"
            subtitle="Inferred from your last 30 posts"
            icon={<Mic className="size-4" strokeWidth={2} />}
          >
            <div className="space-y-3">
              {[
                { label: 'Tone',             value: 'Authoritative · candid' },
                { label: 'Sentence length',  value: 'Short. Mostly under 12 words.' },
                { label: 'Signature moves',  value: 'Numbered lists, contrarian openers' },
                { label: 'Banned phrases',   value: '"As an entrepreneur", "let\'s dive in"' },
              ].map((v) => (
                <div
                  key={v.label}
                  className="flex items-start justify-between gap-3 py-2 border-b border-hairline last:border-0"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                    {v.label}
                  </div>
                  <div className="text-xs font-medium text-right">{v.value}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Shot list"
            subtitle="Auto-generated from the beats"
            icon={<Camera className="size-4" strokeWidth={2} />}
          >
            <ol className="space-y-2">
              {[
                'Selfie hook · golden hour window',
                'Screen-rec of checkout @1.5x',
                'B-roll: hands typing',
                'Stripe overlay (vertical)',
                'Closer selfie · DM CTA',
              ].map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/[0.03] group animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="size-6 rounded-md bg-foreground text-white grid place-items-center text-[10px] font-mono font-bold">
                    {i + 1}
                  </div>
                  <span className="text-xs flex-1">{s}</span>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    strokeWidth={2}
                  />
                </li>
              ))}
            </ol>
          </SectionCard>

          <div className="grid grid-cols-2 gap-3">
            <button className="py-3 rounded-xl ring-1 ring-foreground/10 bg-card hover:shadow-pop transition-all flex items-center justify-center gap-2 text-xs font-semibold">
              <Download className="size-3.5" strokeWidth={2} /> Export PDF
            </button>
            <button className="py-3 rounded-xl bg-foreground text-white hover:bg-foreground/90 transition-all flex items-center justify-center gap-2 text-xs font-semibold">
              <Wand2 className="size-3.5" strokeWidth={2.25} /> Send to studio
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
