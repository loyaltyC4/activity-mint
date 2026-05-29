/**
 * Mood — designed in insight-flow style (no upstream source exists in
 * loyaltyC4/insight-flow; mood.tsx returns 404). Treated as a sibling to
 * Audience: Audience answers "who" and Mood answers "how they feel".
 *
 * Icon swaps to avoid Vite chunk collision with Sidebar:
 *   Smile (in sidebar) → Laugh in pane header
 */
'use strict'

import React from 'react'
import {
  Laugh, Heart, Flame, ThumbsUp, ThumbsDown, Frown, Annoyed,
  Sun, Cloud, CloudRain, Clock, ArrowUpRight, Wand2,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const emotions = [
  { Icon: Laugh,   label: 'Delighted',  pct: 34, color: 'var(--positive)',         note: 'Carousels closing on a payoff slide' },
  { Icon: Heart,   label: 'Inspired',   pct: 22, color: 'var(--brand)',            note: 'Behind-the-scenes reels' },
  { Icon: Flame,   label: 'Excited',    pct: 17, color: 'var(--amber)',            note: 'Launch + product reveal posts' },
  { Icon: ThumbsUp,label: 'Affirming',  pct: 14, color: 'var(--violet)',           note: '"Thank you", "needed this" comments' },
  { Icon: Annoyed, label: 'Critical',   pct: 8,  color: 'var(--muted-foreground)', note: '"Hot take" hooks invite pushback' },
  { Icon: Frown,   label: 'Disengaged', pct: 5,  color: 'var(--negative)',         note: 'Polished UGC underperforming' },
]

const timeline = [
  { t: 'Mon', score: 64, hue: 'var(--positive)'  },
  { t: 'Tue', score: 71, hue: 'var(--positive)'  },
  { t: 'Wed', score: 58, hue: 'var(--amber)'     },
  { t: 'Thu', score: 76, hue: 'var(--positive)'  },
  { t: 'Fri', score: 82, hue: 'var(--brand)'     },
  { t: 'Sat', score: 68, hue: 'var(--positive)'  },
  { t: 'Sun', score: 73, hue: 'var(--positive)'  },
]

const weather = [
  { Icon: Sun,      label: 'Sunny streak',  detail: '4 of last 7 posts → 70+ mood score' },
  { Icon: Cloud,    label: 'Mixed signals', detail: 'Reels lift, carousels neutral' },
  { Icon: CloudRain,label: 'Avoid topic',   detail: '"pricing roast" posts trigger drop' },
]

const triggers = [
  { phrase: 'Made me cry',          count: 412, vibe: 'Delighted',  color: 'var(--positive)' },
  { phrase: 'this is the way',       count: 318, vibe: 'Affirming',  color: 'var(--violet)' },
  { phrase: 'underrated',            count: 264, vibe: 'Inspired',   color: 'var(--brand)' },
  { phrase: 'sus / spammy',          count: 142, vibe: 'Critical',   color: 'var(--amber)' },
  { phrase: 'unfollowing',           count: 38,  vibe: 'Disengaged', color: 'var(--negative)' },
]

export default function MoodPane() {
  const dominant = emotions[0]
  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Mood
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            How your audience feels — derived from comments, reactions, and reply velocity. Scored continuously over the last 7 days.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
          <Wand2 className="size-3.5" strokeWidth={2.25} /> Mood brief
        </button>
      </div>

      {/* Hero — dominant emotion + score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 relative rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-7 overflow-hidden">
          <div
            className="absolute -top-16 -right-16 size-64 blur-3xl rounded-full opacity-40 pointer-events-none"
            style={{ background: dominant.color }}
          />
          <div className="relative">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-2">
              Dominant mood · 7d
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="size-12 rounded-xl grid place-items-center"
                style={{ background: `color-mix(in oklab, ${dominant.color} 15%, transparent)`, color: dominant.color }}
              >
                <dominant.Icon className="size-6" strokeWidth={2} />
              </div>
              <h2 className="font-display font-bold text-4xl tracking-tight">{dominant.label}</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-prose mb-5">
              Audience is responding strongest to {dominant.note.toLowerCase()}. Score holding 6 points above your 90-day baseline.
            </p>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Mood score</div>
                <div className="font-display font-bold text-3xl tabular-nums">73</div>
              </div>
              <div className="h-10 w-px bg-hairline" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">vs. last week</div>
                <div className="font-display font-bold text-3xl tabular-nums text-positive flex items-center gap-1">
                  +9 <ArrowUpRight className="size-5" />
                </div>
              </div>
              <div className="h-10 w-px bg-hairline" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Signal volume</div>
                <div className="font-display font-bold text-3xl tabular-nums">2.1k</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mood weather */}
        <SectionCard
          title="Weather"
          subtitle="Forecast for the next post"
          icon={<Sun className="size-4" strokeWidth={2} />}
        >
          <div className="space-y-2.5">
            {weather.map((w) => {
              const Icon = w.Icon
              return (
                <div key={w.label} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-foreground/[0.03] transition-colors">
                  <div className="size-8 rounded-md bg-foreground/[0.04] grid place-items-center shrink-0">
                    <Icon className="size-4 text-foreground/70" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-display font-semibold tracking-tight">{w.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">{w.detail}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      {/* Emotion split */}
      <SectionCard
        title="Emotion split"
        subtitle="Comment classification across your last 28 posts"
        icon={<Laugh className="size-4" strokeWidth={2} />}
      >
        <div className="space-y-3">
          {emotions.map((e, i) => {
            const Icon = e.Icon
            return (
              <div
                key={e.label}
                className="group flex items-center gap-4 p-2.5 rounded-xl hover:bg-foreground/[0.03] transition-all animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div
                  className="size-9 rounded-lg grid place-items-center shrink-0"
                  style={{ background: `color-mix(in oklab, ${e.color} 12%, transparent)`, color: e.color }}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-display font-semibold tracking-tight">{e.label}</span>
                    <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{e.pct}%</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{e.note}</div>
                  <div className="mt-2 h-1.5 bg-foreground/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full animate-bar-fill"
                      style={{ '--fill-width': `${e.pct * 2.5}%`, background: e.color }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-3">
          <SectionCard
            title="Mood timeline · 7d"
            subtitle="Daily mood score, normalised against your baseline"
            icon={<Clock className="size-4" strokeWidth={2} />}
          >
            <div className="flex items-end justify-between gap-2 h-44 pt-2">
              {timeline.map((d, i) => (
                <div key={d.t} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-md animate-bar-fill"
                      style={{
                        '--fill-width': '100%',
                        height: `${d.score}%`,
                        background: `linear-gradient(to top, ${d.hue}, color-mix(in oklab, ${d.hue} 55%, white))`,
                        animationDelay: `${i * 80}ms`,
                      }}
                    />
                    <div
                      className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold tabular-nums"
                      style={{ color: d.hue }}
                    >
                      {d.score}
                    </div>
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {d.t}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-hairline flex items-center gap-6 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-sm bg-brand" />
                <span className="text-muted-foreground">Peak</span>
                <span className="font-mono font-bold">Fri · 82</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-sm bg-amber" />
                <span className="text-muted-foreground">Dip</span>
                <span className="font-mono font-bold">Wed · 58</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-sm bg-positive" />
                <span className="text-muted-foreground">Avg</span>
                <span className="font-mono font-bold">70.3</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Triggers */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Mood triggers"
            subtitle="Phrases driving each emotion"
            icon={<ThumbsUp className="size-4" strokeWidth={2} />}
          >
            <div className="space-y-2">
              {triggers.map((t) => (
                <div
                  key={t.phrase}
                  className="flex items-center gap-3 p-2.5 rounded-lg ring-1 ring-foreground/[0.05] bg-surface-2/50 hover:bg-card transition-colors"
                >
                  <div className="size-1.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">&quot;{t.phrase}&quot;</div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                      {t.vibe}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums shrink-0">{t.count}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard tone="ink">
        <div className="absolute -top-12 -right-12 size-56 bg-positive/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="size-4 text-positive" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-positive">Mood arbitrage</span>
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight text-white">
              Ride the Delighted wave —{' '}
              <span className="text-positive">+18% reply velocity</span>{' '}
              if you ship a payoff-slide carousel by Sunday.
            </h3>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Mood scores plateau around day 5 unless you reinforce the dominant emotion. Sunday post window catches the weekend re-share spike.
            </p>
          </div>
          <button className="shrink-0 px-5 py-3 bg-brand text-foreground rounded-xl font-semibold text-sm hover:bg-brand/90 transition-all flex items-center gap-2">
            Draft a payoff carousel <ArrowUpRight className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      </SectionCard>
    </>
  )
}
