/**
 * Rewards — designed in insight-flow style (no upstream source)
 * Icon swap: Award (sidebar) → Trophy / Gift in pane to avoid Vite chunk collision
 */
'use strict'

import React from 'react'
import {
  Trophy,
  Gift,
  Flame,
  Zap,
  Wand2,
  Coins,
  ArrowRight,
  Crown,
  Copy,
  Check,
  Calendar,
  Star,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const stats = [
  { label: 'Mint points',      value: '4,820',  delta: '+360 this week', icon: Coins, tone: 'brand' },
  { label: 'Current streak',   value: '17 days', delta: 'longest: 24',     icon: Flame, tone: 'amber' },
  { label: 'Tier',             value: 'Operator', delta: '780 to Strategist', icon: Crown, tone: 'violet' },
]

const quests = [
  { title: 'Ship 5 carousels this week',      reward: 250, progress: 60, eta: '3 done' },
  { title: 'Reach 1 new lead via DM',         reward: 120, progress: 100, eta: 'Ready to claim' },
  { title: 'Run a Script Studio cycle',       reward: 180, progress: 30, eta: '2 of 5 steps' },
  { title: 'Track a new competitor',          reward: 90,  progress: 0,  eta: 'Not started' },
]

const catalog = [
  { title: '1:1 audit w/ a strategist', cost: 4000, eta: '30-min call · within 7d', tag: 'Hot',  tone: 'amber' },
  { title: 'Custom hashtag cluster',     cost: 1200, eta: 'Delivered same day',       tag: 'New',  tone: 'brand' },
  { title: 'Founder-led ad teardown',    cost: 1800, eta: '24h turnaround',           tag: 'Pro',  tone: 'violet' },
  { title: 'Voice clone slot',           cost: 3200, eta: 'Onboarded next Monday',    tag: 'Pro',  tone: 'violet' },
]

const tagTone = {
  brand:  { bg: 'bg-brand-soft',  text: 'text-brand-ink' },
  amber:  { bg: 'bg-amber/10',    text: 'text-amber' },
  violet: { bg: 'bg-violet/10',   text: 'text-violet' },
}

const streak = [
  { day: 'Mon', done: true },
  { day: 'Tue', done: true },
  { day: 'Wed', done: true },
  { day: 'Thu', done: true },
  { day: 'Fri', done: true },
  { day: 'Sat', done: false },
  { day: 'Sun', done: false },
]

export default function RewardsPane() {
  const [copied, setCopied] = React.useState(false)
  const referral = 'mint.gg/u/activity-9F2C'

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Rewards
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Stack Mint points by shipping work. Cash them in for human help, custom drops, and faster lanes across the platform.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
          <Wand2 className="size-3.5" strokeWidth={2.25} /> Claim today&apos;s bonus
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon
          const tone = tagTone[s.tone]
          return (
            <div
              key={s.label}
              className="bg-card rounded-2xl p-5 ring-1 ring-foreground/[0.06] shadow-pane hover:shadow-pop transition-all animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`size-10 rounded-xl ${tone.bg} grid place-items-center`}>
                  <Icon className={`size-5 ${tone.text}`} strokeWidth={2} />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                  {s.label}
                </span>
              </div>
              <div className="font-display font-bold text-3xl tracking-tight tabular-nums">{s.value}</div>
              <div className="text-[11px] font-mono text-muted-foreground mt-1">{s.delta}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SectionCard
            title="Active quests"
            subtitle="Complete to bank Mint points"
            icon={<Zap className="size-4" strokeWidth={2} />}
          >
            <div className="space-y-3">
              {quests.map((q, i) => {
                const ready = q.progress >= 100
                return (
                  <div
                    key={i}
                    className="group p-3 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-sm font-display font-semibold tracking-tight flex-1">
                        {q.title}
                      </div>
                      <span className="text-[10px] font-bold tabular-nums text-brand-ink bg-brand-soft px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                        <Coins className="size-2.5" /> +{q.reward}
                      </span>
                    </div>
                    <div className="h-1.5 bg-foreground/[0.05] rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full animate-bar-fill ${
                          ready ? 'bg-gradient-to-r from-brand to-positive' : 'bg-brand'
                        }`}
                        style={{ '--fill-width': `${q.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground">{q.eta}</span>
                      <button
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                          ready
                            ? 'bg-foreground text-white hover:bg-brand hover:text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {ready ? 'Claim' : 'Continue'} <ArrowRight className="size-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard
            title="Streak"
            subtitle="Ship something every day to keep it alive"
            icon={<Flame className="size-4" strokeWidth={2} />}
          >
            <div className="flex items-end gap-1.5 mb-5">
              {streak.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full aspect-square rounded-lg grid place-items-center ${
                      d.done
                        ? 'bg-gradient-to-br from-brand to-amber text-foreground'
                        : 'ring-1 ring-foreground/10 bg-surface-2/40 text-muted-foreground'
                    }`}
                  >
                    {d.done ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-hairline flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                  Best streak
                </div>
                <div className="font-display font-bold text-lg tabular-nums">24 days</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                  Next milestone
                </div>
                <div className="text-xs font-semibold text-brand-ink flex items-center gap-1 justify-end">
                  <Calendar className="size-3" /> 21d · +500 pts
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Reward catalog"
        subtitle="Trade Mint points for human help and faster lanes"
        icon={<Gift className="size-4" strokeWidth={2} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {catalog.map((r, i) => {
            const tone = tagTone[r.tone]
            return (
              <div
                key={i}
                className="p-5 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/60 hover:bg-card hover:shadow-pop transition-all flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded ${tone.bg} ${tone.text}`}>
                    {r.tag}
                  </span>
                  <Star className="size-3.5 text-muted-foreground" />
                </div>
                <div className="font-display font-semibold tracking-tight text-sm leading-snug flex-1">
                  {r.title}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-2">{r.eta}</div>
                <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between">
                  <span className="text-sm font-bold tabular-nums text-brand-ink flex items-center gap-1">
                    <Coins className="size-3.5" /> {r.cost.toLocaleString()}
                  </span>
                  <button className="px-2.5 py-1 rounded-md bg-foreground text-white text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all flex items-center gap-1">
                    Redeem <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard tone="ink">
        <div className="absolute -top-12 -right-12 size-56 bg-brand/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="size-4 text-brand" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand">Referral · 2x</span>
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight text-white">
              Bring a creator, earn{' '}
              <span className="text-brand">+1,000 Mint pts</span>{' '}
              when they take their first action.
            </h3>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Doubles to +2,000 if they ship a Script Studio cycle in their first week.
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(referral)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="shrink-0 px-5 py-3 bg-brand text-foreground rounded-xl font-semibold text-sm hover:bg-brand/90 transition-all flex items-center gap-2"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : referral}
          </button>
        </div>
      </SectionCard>
    </>
  )
}
