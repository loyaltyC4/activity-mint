/**
 * Content Lab — content type breakdown, best-time heatmap, hashtag ROI.
 * Phase 2 scaffold; Phase 5 fills with real post analysis.
 */

'use strict'

import React from 'react'
import { LayoutGrid, Clock, Hash } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

function Card({ title, subtitle, Icon, accent = 'teal', children }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-${accent}-50 text-${accent}-600`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold">{title}</div>
          <div className="text-xs text-[#64756f]">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function HeatmapPlaceholder() {
  // 7 rows (Mon-Sun) x 24 cols (hours)
  return (
    <div className="grid grid-cols-24 gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
      {Array.from({ length: 7 * 24 }).map((_, i) => {
        const h = i % 24
        const intensity = h >= 18 && h <= 22 ? 'bg-teal-400' : h >= 12 && h <= 17 ? 'bg-teal-200' : 'bg-teal-50'
        return <div key={i} className={`aspect-square rounded-[3px] ${intensity}`} />
      })}
    </div>
  )
}

export default function ContentLabPane({ timeRange }) {
  return (
    <>
      <PaneHeader title="Content Lab" subtitle={`What's working — ${timeRange}`} />
      <div className="space-y-4">
        <Card title="Content type breakdown" subtitle="Photos vs videos vs carousels vs reels" Icon={LayoutGrid}>
          <div className="grid grid-cols-4 gap-3">
            {['Photo','Video','Carousel','Reel'].map((label, i) => (
              <div key={label}>
                <div className="mb-1 text-xs font-semibold text-[#64756f]">{label}</div>
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Best time to post" subtitle="Engagement by day-of-week × hour" Icon={Clock} accent="violet">
          <HeatmapPlaceholder />
          <div className="mt-3 flex items-center justify-between text-[11px] text-[#64756f]">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </Card>

        <Card title="Hashtag ROI" subtitle="Which tags actually move the needle" Icon={Hash} accent="amber">
          <div className="space-y-2">
            {['#editingtips','#bts','#studio','#creatorlife'].map((tag) => (
              <div key={tag} className="flex items-center justify-between rounded-xl bg-[#f0f4f3] p-3">
                <span className="text-[13px] font-semibold">{tag}</span>
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
