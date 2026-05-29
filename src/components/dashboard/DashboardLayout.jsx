/**
 * Dashboard layout shell.
 * Full-page: h-screen overflow-hidden with scrolling only in the content area.
 * Design system: Insight Flow tokens (brand teal, Inter Tight, JetBrains Mono)
 * unified with the Minted Bento landing page palette.
 */

'use strict'

import React, { Suspense, lazy } from 'react'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { PANES } from './index'

// ── Lazy-loaded panes ────────────────────────────────────────────────────
const PulsePane          = lazy(() => import('./panes/PulsePane'))
const AudiencePane       = lazy(() => import('./panes/AudiencePane'))
const ContentPane        = lazy(() => import('./panes/ContentLabPane'))
const ScriptStudioPane   = lazy(() => import('./panes/ScriptStudioPane'))
const SentimentPane      = lazy(() => import('./panes/SentimentPane'))
const TrendsPane         = lazy(() => import('./panes/TrendsPane'))
const AdLabPane          = lazy(() => import('./panes/AdLabPane'))
const NextPostPane       = lazy(() => import('./panes/NextPostPane'))
const TemplateStudioPane = lazy(() => import('./panes/TemplateStudioPane'))
const OutreachPane       = lazy(() => import('./panes/OutreachPane'))
const ToolsPane          = lazy(() => import('./panes/ToolsPane'))
const CompetitorsPane    = lazy(() => import('./panes/CompetitorsPane'))
const RewardsPane        = lazy(() => import('./panes/RewardsPane'))
const SettingsPane       = lazy(() => import('./panes/SettingsPane'))

function PanePlaceholder({ paneId }) {
  const meta = PANES[paneId]
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-card p-8 shadow-pane">
      <div className="mb-1.5 font-jbmono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {meta?.group}
      </div>
      <h2 className="font-tight text-2xl font-bold tracking-tight">{meta?.label}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Coming soon.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  )
}

function PaneFallback() {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-card p-6 shadow-pane">
      <Skeleton className="h-6 w-1/4 rounded-full" />
      <Skeleton className="mt-2 h-4 w-2/5 rounded-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
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
    case 'adlab':       return <AdLabPane       timeRange={timeRange} />
    case 'planner':     return <NextPostPane    timeRange={timeRange} />
    case 'templates':   return <TemplateStudioPane timeRange={timeRange} />
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
    /* Full-page shell — only the content column scrolls */
    <div className="flex h-screen flex-col overflow-hidden"
         style={{ background: 'oklch(0.99 0.002 180)', color: 'oklch(0.16 0.01 240)' }}>

      <Topbar
        user={user}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        onSettingsClick={() => onPaneChange('settings')}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          user={user}
          tier={tier}
          activePane={activePane}
          onPaneChange={onPaneChange}
        />

        {/* Scrollable content column */}
        <main
          className="min-w-0 flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'oklch(0.85 0.005 240) transparent' }}
        >
          <div className="px-6 py-6 pb-12 md:px-8">
            <div key={activePane} className="animate-entrance">
              <Suspense fallback={<PaneFallback />}>
                <PaneRouter paneId={activePane} timeRange={timeRange} />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
