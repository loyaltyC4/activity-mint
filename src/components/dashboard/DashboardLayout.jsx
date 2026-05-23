/**
 * Layout shell: topbar at the top, sidebar on the left, pane content centre.
 *
 * The pane switch is INLINE for Phase 2 Commit B so the dashboard renders
 * end-to-end before all the real panes exist. Each pane is a stub here that
 * gets replaced by a real lazy-loaded component in Commits D/E/F.
 */

'use strict'

import React, { Suspense, lazy } from 'react'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { PANES } from './index'

// Pane components will be lazy-loaded as Commits D/E/F land.
// For now every pane renders the PanePlaceholder stub below.
function PanePlaceholder({ paneId }) {
  const meta = PANES[paneId]
  return (
    <div className="rounded-3xl bg-card p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {meta?.group}
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{meta?.label}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This pane will render in a later Phase 2 commit. The layout shell is in place;
        each pane gets its own file under <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/components/dashboard/panes/</code>.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

export default function DashboardLayout({
  user,
  tier,
  activePane,
  onPaneChange,
  timeRange,
  onTimeRangeChange,
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
        <Sidebar
          user={user}
          tier={tier}
          activePane={activePane}
          onPaneChange={onPaneChange}
        />

        <main className="min-w-0 flex-1 px-7 pb-24 pt-7">
          <Suspense fallback={<div className="rounded-3xl bg-card p-6"><Skeleton className="h-64 rounded-xl" /></div>}>
            <PanePlaceholder paneId={activePane} />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
