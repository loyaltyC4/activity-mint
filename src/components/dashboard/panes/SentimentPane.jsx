/**
 * Sentiment — comment analysis + audience mood themes.
 * Phase 2 scaffold; Phase 5 wires to comment scraping via the cluster.
 */

'use strict'

import React from 'react'
import { MessageSquare, Heart, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

function StickyNote({ tone, title, body }) {
  const bg = tone === 'green' ? 'bg-emerald-100' : tone === 'yellow' ? 'bg-amber-100' : 'bg-rose-100'
  return (
    <div className={`rounded-lg ${bg} p-4 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] transition-transform hover:scale-[1.02]`}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-foreground/60">{title}</div>
      <Skeleton className="mt-2 h-4 w-full rounded-full bg-foreground/10" />
      <Skeleton className="mt-1.5 h-4 w-2/3 rounded-full bg-foreground/10" />
    </div>
  )
}

export default function SentimentPane({ timeRange }) {
  return (
    <>
      <PaneHeader title="Sentiment" subtitle={`What people are saying — ${timeRange}`} />
      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <Heart className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold">Mood meter</div>
              <div className="text-xs text-[#64756f]">Positive / neutral / negative split from your comments</div>
            </div>
          </div>
          <div className="mt-4 flex h-3.5 overflow-hidden rounded-full bg-[#f0f4f3] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            <div className="h-full w-3/4 bg-emerald-500" />
            <div className="h-full w-[15%] bg-slate-400" />
            <div className="h-full w-[10%] bg-rose-500" />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[#64756f]">
            <span>75% positive</span><span>15% neutral</span><span>10% negative</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-violet-600" />
            <div>
              <div className="text-base font-bold">What people are saying</div>
              <div className="text-xs text-[#64756f]">Themes from recent comments</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StickyNote tone="green"  title="Love it"           />
            <StickyNote tone="yellow" title="Asking for more"   />
            <StickyNote tone="green"  title="Sharing it onward" />
            <StickyNote tone="peach"  title="Asking questions"  />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-base font-bold">Watch list</div>
              <div className="text-xs text-[#64756f]">Comments that may need a reply</div>
            </div>
          </div>
          <div className="space-y-2">
            {[0,1,2].map((i) => (
              <div key={i} className="rounded-xl bg-[#f0f4f3]/60 p-3 border-l-4 border-amber-400">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="mt-1.5 h-3 w-1/3 rounded-full" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#64756f]">Wired to live comment scraping in Phase 5.</p>
        </div>
      </div>
    </>
  )
}
