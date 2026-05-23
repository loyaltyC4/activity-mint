/**
 * Trends & Insights — emerging hashtags / formats / topics with "why this
 * works" annotations and a Copy Template button so the user can recreate
 * the post structure for their own content.
 * Phase 2 scaffold; Phase 5 wires real trend detection.
 */

'use strict'

import React from 'react'
import { TrendingUp, Copy, Flame } from 'lucide-react'

function PaneHeader({ title, subtitle, badge }) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
      </div>
      {badge && <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-600">{badge}</span>}
    </div>
  )
}

const PLACEHOLDER_TRENDS = [
  { tag: 'How-to Reels', state: 'rising', delta: '+38%', why: ['Pulls saves at 3.2x photos', 'Audience peaks Thu 7pm', 'Strong first-2-sec hook'] },
  { tag: 'Behind-the-scenes',  state: 'rising', delta: '+22%', why: ['Higher comment depth', 'Builds parasocial trust', 'Works on weekends'] },
  { tag: 'Tutorial threads',   state: 'hot',    delta: '+14%', why: ['Mentions of "tutorial" up 40%', 'Long watch time', 'Drives DMs'] },
  { tag: 'Studio walk-arounds',state: 'stable', delta: '+4%',  why: ['Consistent reach', 'Low engagement risk'] },
]

const STATE_TAG = {
  rising: 'bg-teal-50 text-teal-600',
  hot:    'bg-rose-50 text-rose-500',
  stable: 'bg-[#f0f4f3] text-[#64756f]',
}

function TrendCard({ trend, onCopy }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold">{trend.tag}</span>
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${STATE_TAG[trend.state]}`}>
              {trend.state === 'hot' ? <Flame className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {trend.delta}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-[#64756f]">Why this works:</div>
        </div>
        <button
          onClick={() => onCopy(trend)}
          className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#f0f4f3] px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-teal-50 hover:text-teal-600"
        >
          <Copy className="h-3 w-3" />
          Copy template
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {trend.why.map((w) => (
          <span key={w} className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-600 shadow-[0_0_0_1px_rgba(20,184,166,0.3)]">
            {w}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function TrendsPane({ timeRange }) {
  const handleCopy = (trend) => {
    const text = `Trend: ${trend.tag}\nWhy: ${trend.why.join(' · ')}\nTemplate: format — ${trend.tag.toLowerCase()}\nBest time: Thu 7pm`
    navigator.clipboard?.writeText(text).catch(() => {})
  }
  return (
    <>
      <PaneHeader title="Trends & Insights" subtitle={`What's working right now — ${timeRange}`} badge="New" />
      <div className="space-y-4">
        {PLACEHOLDER_TRENDS.map((t, i) => (
          <TrendCard key={i} trend={t} onCopy={handleCopy} />
        ))}
      </div>
      <p className="mt-4 text-xs text-[#64756f]">Trends are placeholders — Phase 5 wires real detection from your hashtag ROI + comment themes.</p>
    </>
  )
}
