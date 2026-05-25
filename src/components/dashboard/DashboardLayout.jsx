/**
 * Layout shell: topbar at the top, sidebar on the left, pane content centre.
 * Each pane is lazy-loaded so the initial bundle stays small.
 */

'use strict'

import React, { Suspense, lazy } from 'react'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { PANES } from './index'

// ── Lazy-loaded panes ────────────────────────────────────────────────────
const PulsePane       = lazy(() => import('./panes/PulsePane'))
const AudiencePane    = lazy(() => import('./panes/AudiencePane'))
const ContentPane     = lazy(() => import('./panes/ContentLabPane'))
const ScriptStudioPane = lazy(() => import('./panes/ScriptStudioPane'))
const SentimentPane   = lazy(() => import('./panes/SentimentPane'))
const TrendsPane      = lazy(() => import('./panes/TrendsPane'))
const OutreachPane    = lazy(() => import('./panes/OutreachPane'))
const ToolsPane       = lazy(() => import('./panes/ToolsPane'))
const CompetitorsPane = lazy(() => import('./panes/CompetitorsPane'))
const RewardsPane     = lazy(() => import('./panes/RewardsPane'))
const SettingsPane    = lazy(() => import('./panes/SettingsPane'))

function PanePlaceholder({ paneId }) {
  const meta = PANES[paneId]
  return (
    <div className="rounded-3xl bg-card p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {meta?.group}
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{meta?.label}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Coming in the next phase 2 commit.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    </div>
  )
}

function PaneFallback() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <Skeleton className="h-8 w-1/3 rounded-full" />
      <Skeleton className="mt-2 h-4 w-1/2 rounded-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    </div>
  )
}

function PaneRouter({ paneId, timeRange }) {
  switch (paneId) {
    case 'pulse':       return <PulsePane       timeRange={timeRange} />
    case 'audience':    return <AudiencePane    timeRange={timeRange} />
    case 'content':     return <ContentPane     timeRange={timeRange} />
    case 'script':      return <ScriptStudioPane timeRange={timeRange} />
    case 'sentiment':   return <SentimentPane   timeRange={timeRange} />
    case 'trends':      return <TrendsPane      timeRange={timeRange} />
    case 'outreach':    return <OutreachPane    timeRange={timeRange} />
    case 'toolkit':     return <ToolsPane />
    case 'competitors': return <CompetitorsPane timeRange={timeRange} />
    case 'rewards':     return <RewardsPane />
    case 'settings':    return <SettingsPane />
    default:            return <PanePlaceholder paneId={paneId} />
  }
}

export default function DashboardLayout({
  user, tier,
  activePane, onPaneChange,
  timeRange, onTimeRangeChange,
}) {
  return (
    <div className="min-h-screen bg-[#f7faf9] text-foreground antialiased">
      <Topbar
        user={user}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        onSettingsClick={() => onPaneChange('settings')}
      />
      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar user={user} tier={tier} activePane={activePane} onPaneChange={onPaneChange} />
        <main className="min-w-0 flex-1 px-7 pb-24 pt-7">
          <Suspense fallback={<PaneFallback />}>
            <PaneRouter paneId={activePane} timeRange={timeRange} />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
