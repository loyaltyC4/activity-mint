/**
 * Audience — 1:1 port of insight-flow's audience.tsx
 * Icon swap: Sparkles → Wand2 (Sparkles is used by Sidebar.jsx and would
 * collide in Vite's lazy chunk dedupe pass).
 */
'use strict'

import React from 'react'
import { Heart, Wand2, MapPin } from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const commenters = [
  { name: '@elena.codes',    count: 47, persona: 'Builder',   color: 'var(--brand)' },
  { name: '@matt_designs',   count: 38, persona: 'Designer',  color: 'var(--violet)' },
  { name: '@founder.diary',  count: 31, persona: 'Founder',   color: 'var(--amber)' },
  { name: '@thelaurastudio', count: 28, persona: 'Creator',   color: 'var(--brand)' },
  { name: '@growth.iain',    count: 24, persona: 'Marketer',  color: 'var(--violet)' },
  { name: '@nora.builds',    count: 19, persona: 'Builder',   color: 'var(--brand)' },
]

const interests = [
  { tag: 'indie-dev',       pct: 84 },
  { tag: 'design-systems',  pct: 71 },
  { tag: 'ai-tooling',      pct: 66 },
  { tag: 'founder-life',    pct: 58 },
  { tag: 'remote-work',     pct: 42 },
  { tag: 'typography',      pct: 39 },
]

const regions = [
  { name: 'United States',  pct: 38, color: 'var(--brand)' },
  { name: 'United Kingdom', pct: 18, color: 'var(--violet)' },
  { name: 'Australia',      pct: 14, color: 'var(--amber)' },
  { name: 'Germany',        pct: 9,  color: 'var(--brand-ink)' },
  { name: 'Other',          pct: 21, color: 'var(--muted-foreground)' },
]

export default function AudiencePane() {
  return (
    <>
      <div>
        <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
          Audience
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          Personas extracted from comment metadata and follower bios.
        </p>
      </div>

      <SectionCard
        title="Top commenters"
        subtitle="Most active accounts in your last few posts — your most engaged audience"
        icon={<Heart className="size-4" strokeWidth={2} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {commenters.map((c, i) => (
            <div key={c.name} className="flex items-center gap-4 group">
              <div className="font-mono text-[10px] text-muted-foreground tabular-nums w-5">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                className="size-9 rounded-full grid place-items-center text-white font-display font-bold text-xs shrink-0"
                style={{ background: `linear-gradient(135deg, ${c.color}, color-mix(in oklab, ${c.color} 60%, black))` }}
              >
                {c.name[1].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold tracking-tight truncate">{c.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{c.persona}</div>
              </div>
              <div className="flex items-center gap-2 w-32">
                <div className="flex-1 h-1.5 bg-foreground/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full animate-bar-fill"
                    style={{ '--fill-width': `${(c.count / 47) * 100}%`, background: c.color }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold tabular-nums w-6 text-right">{c.count}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Audience interest"
          subtitle="What your followers care about, extracted from bios + hashtags"
          icon={<Wand2 className="size-4" strokeWidth={2} />}
        >
          <div className="space-y-3">
            {interests.map((tag) => (
              <div key={tag.tag} className="flex items-center gap-4">
                <div className="font-mono text-xs tracking-tight w-36 truncate">#{tag.tag}</div>
                <div className="flex-1 h-2 bg-foreground/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand to-brand-ink rounded-full animate-bar-fill"
                    style={{ '--fill-width': `${tag.pct}%` }}
                  />
                </div>
                <div className="text-xs font-mono font-semibold tabular-nums w-10 text-right">{tag.pct}%</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Geographic spread"
          subtitle="Where your audience lives — extracted from bio signals"
          icon={<MapPin className="size-4" strokeWidth={2} />}
        >
          {/* Stacked bar */}
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-foreground/[0.05]">
            {regions.map((r) => (
              <div
                key={r.name}
                className="h-full animate-bar-fill"
                style={{ width: `${r.pct}%`, background: r.color, '--fill-width': `${r.pct}%` }}
                title={`${r.name} · ${r.pct}%`}
              />
            ))}
          </div>
          <div className="mt-5 space-y-2.5">
            {regions.map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <div className="size-2.5 rounded-sm" style={{ background: r.color }} />
                <span className="text-sm font-medium flex-1">{r.name}</span>
                <span className="text-xs font-mono font-semibold tabular-nums">{r.pct}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  )
}
