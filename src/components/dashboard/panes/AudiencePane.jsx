/**
 * Audience & Mood — demographic breakdown + sentiment overview.
 * Phase 2 scaffold; Phase 5 fills with real follower/comment analysis.
 */

'use strict'

import React from 'react'
import { Users, Globe, Smile } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

function PlaceholderCard({ title, subtitle, Icon, accent = 'teal' }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-${accent}-50 text-${accent}-600`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold">{title}</div>
          <div className="text-xs text-[#64756f]">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-3 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" />
      </div>
      <p className="mt-4 text-xs text-[#64756f]">
        Coming in Phase 5 — wired to your actual follower data through workers 2/3/5.
      </p>
    </div>
  )
}

export default function AudiencePane({ timeRange }) {
  return (
    <>
      <PaneHeader title="Audience &amp; Mood" subtitle={`Who's listening — ${timeRange}`} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlaceholderCard title="Sentiment overview"   subtitle="How positive your audience is right now" Icon={Smile} accent="amber" />
        <PlaceholderCard title="Demographics"         subtitle="Gender / age / location splits"          Icon={Users} accent="violet" />
        <PlaceholderCard title="Geographic spread"    subtitle="Where your followers live"               Icon={Globe} accent="sky" />
        <PlaceholderCard title="Engagement cohorts"   subtitle="Power fans vs. ghost followers"          Icon={Users} accent="teal" />
      </div>
    </>
  )
}
