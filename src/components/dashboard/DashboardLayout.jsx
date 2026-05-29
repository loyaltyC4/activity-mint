/**
 * DashboardLayout — exact port of insight-flow's DashboardLayout.tsx
 * min-h-screen flex, sidebar + content column, max-w-7xl content area.
 */
'use strict'
import React, { Suspense, lazy } from 'react'
import DashboardSidebar from './Sidebar'
import Topbar from './Topbar'
import { Skeleton } from '@/components/ui/skeleton'
import { PANES } from './index'

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
    <div className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-16 text-center">
      <div className="inline-flex size-12 rounded-2xl bg-brand-soft text-brand-ink items-center justify-center mb-5">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
      </div>
      <h2 className="font-display font-bold text-2xl tracking-tight mb-2">{meta?.label}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Shell and design language are ready — data wiring is in flight.
      </p>
    </div>
  )
}

function PaneFallback() {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-6">
      <Skeleton className="h-6 w-1/4 rounded-full mb-2" />
      <Skeleton className="h-4 w-2/5 rounded-full mb-6" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
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
  const meta = PANES[activePane] || {}

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <DashboardSidebar
        user={user}
        tier={tier}
        activePane={activePane}
        onPaneChange={onPaneChange}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={meta.label || 'Dashboard'}
          subtitle={`${meta.group || ''} — ${timeRange} view`}
          timeRange={timeRange}
          onTimeRangeChange={onTimeRangeChange}
          onSettingsClick={() => onPaneChange('settings')}
          user={user}
        />
        <main className="flex-1 px-6 lg:px-8 py-8 animate-fade-up overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-8">
            <Suspense fallback={<PaneFallback />}>
              <div key={activePane}>
                <PaneRouter paneId={activePane} timeRange={timeRange} />
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
