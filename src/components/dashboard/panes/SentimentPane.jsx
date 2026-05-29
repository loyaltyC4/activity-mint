/**
 * Sentiment — 1:1 port of insight-flow's sentiment.tsx
 *
 * Icon swap: MessageSquare → MessageCircle (MessageSquare is in Sidebar parent chunk)
 *
 * Fluid loading: mood meter bars animate in with bar-fill keyframe,
 * phrase chips fade-up on mount.
 */
'use strict'

import React from 'react'
import { Heart, MessageCircle, AlertCircle } from 'lucide-react'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import SectionCard from '../shared/SectionCard'

const phrases = [
  { word: 'love this',         count: 142, mood: 'pos' },
  { word: 'underrated',        count: 89,  mood: 'pos' },
  { word: '🔥',                  count: 78,  mood: 'pos' },
  { word: 'where do I sign',   count: 64,  mood: 'pos' },
  { word: 'how does it work',  count: 52,  mood: 'neu' },
  { word: 'pricing',           count: 41,  mood: 'neu' },
  { word: 'any plans for',     count: 38,  mood: 'neu' },
  { word: 'not for me',        count: 12,  mood: 'neg' },
  { word: 'too expensive',     count: 9,   mood: 'neg' },
]

const moodColors = {
  pos: 'var(--positive)',
  neu: 'var(--muted-foreground)',
  neg: 'var(--negative)',
}

const watchList = [
  { user: '@growth.iain',   text: 'Do you support TikTok handle ingestion yet?',                    mood: 'neu', time: '12m' },
  { user: '@matt_designs',  text: 'Pricing feels steep vs alternatives — any annual discount?',     mood: 'neg', time: '1h'  },
  { user: '@founder.diary', text: 'Will Pipeline Intercept work for B2B with smaller followings?',  mood: 'neu', time: '3h'  },
  { user: '@noisy_reply',   text: "Genuinely the best dashboard I've seen this year.",              mood: 'pos', time: '5h'  },
]

export default function SentimentPane({ timeRange = '7d' }) {
  const { handle } = useTrackedAccount()
  const displayHandle = handle ? `@${handle}` : 'your account'

  return (
    <>
      <div>
        <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
          Sentiment
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          A composite of comment polarity, intent and phrase frequency for {displayHandle} — {timeRange}.
        </p>
      </div>

      {/* Mood meter */}
      <SectionCard
        title="Mood meter"
        subtitle="Positive / neutral / negative breakdown of recent commenters"
        icon={<Heart className="size-4" strokeWidth={2} />}
      >
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-foreground/[0.05] mb-6">
          <div
            className="h-full bg-positive animate-bar-fill"
            style={{ width: '68%', '--fill-width': '68%' }}
          />
          <div
            className="h-full bg-muted-foreground/40 animate-bar-fill"
            style={{ width: '24%', '--fill-width': '24%' }}
          />
          <div
            className="h-full bg-negative animate-bar-fill"
            style={{ width: '8%', '--fill-width': '8%' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Positive', pct: '68%', n: '412 comments', color: 'var(--positive)',        bg: 'color-mix(in oklab, var(--positive) 10%, var(--card))' },
            { label: 'Neutral',  pct: '24%', n: '146 comments', color: 'var(--muted-foreground)', bg: 'var(--surface-2)' },
            { label: 'Negative', pct: '8%',  n: '48 comments',  color: 'var(--negative)',        bg: 'color-mix(in oklab, var(--negative) 10%, var(--card))' },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl p-4 ring-1 ring-foreground/5"
              style={{ background: c.bg }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div className="size-1.5 rounded-full" style={{ background: c.color }} />
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.15em]"
                  style={{ color: c.color }}
                >
                  {c.label}
                </span>
              </div>
              <div className="font-display font-bold text-2xl tracking-tight tabular-nums">
                {c.pct}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{c.n}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Phrase cloud */}
      <SectionCard
        title="What people are saying"
        subtitle="Top words + hashtags surfacing in your comments"
        icon={<MessageCircle className="size-4" strokeWidth={2} />}
      >
        <div className="flex flex-wrap gap-2">
          {phrases.map((p) => {
            const scale = 0.85 + (Math.min(p.count, 150) / 150) * 0.6
            return (
              <span
                key={p.word}
                className="rounded-full px-3 py-1.5 ring-1 ring-foreground/5 font-medium hover:scale-105 transition-transform cursor-default animate-fade-up"
                style={{
                  fontSize: `${12 * scale}px`,
                  background: `color-mix(in oklab, ${moodColors[p.mood]} 10%, var(--card))`,
                  color: moodColors[p.mood],
                }}
              >
                {p.word}
                <span className="font-mono text-[10px] opacity-60 ml-1.5">{p.count}</span>
              </span>
            )
          })}
        </div>
      </SectionCard>

      {/* Watch list */}
      <SectionCard
        title="Watch list"
        subtitle="Questions and negatives — these usually deserve a reply"
        icon={<AlertCircle className="size-4" strokeWidth={2} />}
      >
        <div className="space-y-3">
          {watchList.map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl border-l-2 animate-fade-up"
              style={{
                borderColor: moodColors[c.mood],
                background: `color-mix(in oklab, ${moodColors[c.mood]} 5%, var(--card))`,
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div className="size-8 rounded-full bg-gradient-to-br from-brand-ink to-foreground grid place-items-center text-white font-mono font-bold text-[10px] shrink-0">
                {c.user[1].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold tracking-tight">{c.user}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{c.time} ago</span>
                </div>
                <p className="text-sm text-foreground/80">{c.text}</p>
              </div>
              <button className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand hover:underline shrink-0 mt-1">
                Reply →
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  )
}
