/**
 * Competitors — 1:1 port of insight-flow's competitors.tsx
 * Icon swaps: Globe → Earth, TrendingUp → ArrowUpRight, MessageSquare → MessageCircle, Sparkles → Wand2
 */
'use strict'

import React from 'react'
import {
  Earth,
  Plus,
  ArrowUpRight,
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Wand2,
  Target,
  ArrowRight,
  Crosshair,
  Zap,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const competitors = [
  { handle: '@hormozi',       name: 'Alex Hormozi',   followers: '4.2M',  er: 5.8, growth: '+12.4%', posts: 18, gap: -2.1, threat: 'high' },
  { handle: '@chrisdo',       name: 'Chris Do',       followers: '1.1M',  er: 4.2, growth: '+8.7%',  posts: 12, gap: -0.5, threat: 'med' },
  { handle: '@garyvee',       name: 'Gary Vee',       followers: '10.4M', er: 2.4, growth: '+2.1%',  posts: 32, gap: +1.8, threat: 'low' },
  { handle: '@codiesanchez',  name: 'Codie Sanchez',  followers: '988K',  er: 6.1, growth: '+18.2%', posts: 14, gap: -2.4, threat: 'high' },
]

const gaps = [
  { title: 'Long-form carousel teardowns',  evidence: '@hormozi posts 4/wk · you post 0',               lift: '+184%', action: 'Generate first one' },
  { title: 'Founder-led talking-head ads',  evidence: '3 competitors adopted in last 14d',              lift: '+121%', action: 'Open Script Studio' },
  { title: 'Reply-guy comment strategy',    evidence: '@codiesanchez replies on 80% of competitor threads', lift: '+88%',  action: 'Set up alerts' },
]

const threatMap = {
  high: { bg: 'bg-negative/10', text: 'text-negative', label: 'High' },
  med:  { bg: 'bg-amber/10',    text: 'text-amber',    label: 'Med' },
  low:  { bg: 'bg-positive/10', text: 'text-positive', label: 'Low' },
}

const headToHead = [
  { iconKey: 'eye',      label: 'Reach',             you: 1420000, them: 2840000, unit: '' },
  { iconKey: 'heart',    label: 'Engagement rate',   you: 4.2,     them: 4.6,     unit: '%' },
  { iconKey: 'bookmark', label: 'Saves / post',      you: 1240,    them: 1880,    unit: '' },
  { iconKey: 'msg',      label: 'Comments / post',   you: 184,     them: 142,     unit: '' },
]

const iconForKey = {
  eye:      Eye,
  heart:    Heart,
  bookmark: Bookmark,
  msg:      MessageCircle,
}

export default function CompetitorsPane() {
  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Competitors
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Continuous teardown of the 4 accounts you&apos;re chasing. Activity Mint flags every gap and ships a counter-move to your queue.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
          <Plus className="size-3.5" strokeWidth={2.25} /> Track new account
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {competitors.map((c) => {
          const threat = threatMap[c.threat]
          const positive = c.gap > 0
          return (
            <div
              key={c.handle}
              className="bg-card rounded-2xl p-5 ring-1 ring-foreground/[0.06] shadow-pane hover:shadow-pop transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="size-10 rounded-full bg-gradient-to-br from-foreground via-brand-ink to-brand grid place-items-center text-white font-display font-bold text-sm">
                  {c.name.split(' ').map((s) => s[0]).join('')}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${threat.bg} ${threat.text}`}>
                  {threat.label} threat
                </span>
              </div>
              <div className="text-sm font-display font-semibold tracking-tight">{c.name}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {c.handle} · {c.followers}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">ER</div>
                  <div className="font-bold tabular-nums">{c.er}%</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Growth</div>
                  <div className="font-bold tabular-nums text-positive">{c.growth}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Posts / wk</div>
                  <div className="font-bold tabular-nums">{c.posts}</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground">Your gap</div>
                  <div
                    className={`font-bold tabular-nums flex items-center gap-0.5 ${
                      positive ? 'text-positive' : 'text-negative'
                    }`}
                  >
                    {positive ? <ArrowUpRight className="size-3" /> : <TrendingDown className="size-3" />}{' '}
                    {Math.abs(c.gap)}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-hairline flex items-center gap-2">
                <button className="flex-1 py-1.5 rounded-md bg-foreground text-white text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all flex items-center justify-center gap-1">
                  <Crosshair className="size-3" /> Intercept
                </button>
                <button
                  aria-label="View competitor"
                  className="size-7 rounded-md ring-1 ring-foreground/10 grid place-items-center hover:bg-foreground/[0.04]"
                >
                  <Eye className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SectionCard
            title="Head-to-head · last 30 days"
            subtitle="You vs the cohort average"
            icon={<Target className="size-4" strokeWidth={2} />}
          >
            <div className="space-y-5">
              {headToHead.map((m) => {
                const Icon = iconForKey[m.iconKey]
                const max = Math.max(m.you, m.them)
                const youPct = (m.you / max) * 100
                const themPct = (m.them / max) * 100
                const leading = m.you > m.them
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 text-muted-foreground" strokeWidth={2} />
                        <span className="text-xs font-semibold tracking-tight">{m.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          leading ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                        }`}
                      >
                        {leading ? 'Leading' : 'Chasing'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Bar label="You"        value={`${formatNum(m.you)}${m.unit}`}  pct={youPct}  tone="brand" />
                      <Bar label="Cohort avg" value={`${formatNum(m.them)}${m.unit}`} pct={themPct} tone="muted" />
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard
            title="Gap analysis"
            subtitle="What competitors do that you don't"
            icon={<Zap className="size-4" strokeWidth={2} />}
          >
            <div className="space-y-3">
              {gaps.map((g, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50 hover:bg-card transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="text-sm font-display font-semibold tracking-tight leading-snug flex-1">
                      {g.title}
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-positive bg-positive/10 px-1.5 py-0.5 rounded shrink-0">
                      {g.lift}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{g.evidence}</p>
                  <button className="w-full py-1.5 rounded-md bg-foreground text-white text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all flex items-center justify-center gap-1.5">
                    <Wand2 className="size-3" /> {g.action} <ArrowRight className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard tone="ink">
        <div className="absolute -top-12 -right-12 size-56 bg-brand/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
          <div>
            <Earth className="size-5 text-brand mb-3" />
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight text-white">
              Pipeline Intercept · auto-counter every gap
            </h3>
            <p className="text-sm text-white/60 mt-2 max-w-xl">
              Activity Mint drafts a counter-move within 15 minutes of any competitor going viral — landed in your Script Studio queue.
            </p>
          </div>
          <button className="shrink-0 px-5 py-3 bg-brand text-foreground rounded-xl font-semibold text-sm hover:bg-brand/90 transition-all">
            Enable for $149/mo →
          </button>
        </div>
      </SectionCard>
    </>
  )
}

function Bar({ label, value, pct, tone }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        {label}
      </div>
      <div className="flex-1 h-2 bg-foreground/[0.05] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full animate-bar-fill ${
            tone === 'brand' ? 'bg-brand' : 'bg-foreground/30'
          }`}
          style={{ '--fill-width': `${pct}%` }}
        />
      </div>
      <div className="w-20 text-right text-xs font-bold tabular-nums">{value}</div>
    </div>
  )
}

function formatNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
