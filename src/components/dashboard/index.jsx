/**
 * New dashboard entry point.
 *
 * Mounted at /dashboard-v2 during Phase 2-5. After Phase 6 cutover this
 * becomes the default /dashboard route and the legacy Dashboard.jsx
 * (180KB monolith) gets retired.
 *
 * Holds the cross-pane state: active pane id, time range, tracked account.
 * Renders the layout shell with the requested pane inside.
 */

'use strict'

import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTier } from '../../context/TierContext'
import { TrackedAccountProvider } from '../../context/TrackedAccountContext'
import DashboardLayout from './DashboardLayout'
import { NavigationContext } from './NavigationContext'

export const PANES = {
  // Overview — what's happening now
  pulse:       { group: 'Overview',      label: 'Pulse' },
  audience:    { group: 'Overview',      label: 'Audience & Mood' },
  sentiment:   { group: 'Overview',      label: 'Sentiment' },
  // Intelligence — what works and why
  content:     { group: 'Intelligence',  label: 'Content Lab' },
  script:      { group: 'Intelligence',  label: 'Script Studio', badge: 'pro' },
  adlab:       { group: 'Intelligence',  label: 'Ad Intelligence', badge: 'new' },
  // Create — turn insights into action
  planner:     { group: 'Create',        label: 'Next Post',       badge: 'new' },
  templates:   { group: 'Create',        label: 'Template Studio', badge: 'new' },
  // Grow — scale what works
  trends:      { group: 'Grow',          label: 'Trends & Insights', badge: 'new' },
  outreach:    { group: 'Grow',          label: 'Outreach Ideas' },
  toolkit:     { group: 'Grow',          label: 'Tools' },
  competitors: { group: 'Grow',          label: 'Competitors', badge: 'pro' },
  // You
  rewards:     { group: 'You',           label: 'Rewards' },
  settings:    { group: 'You',           label: 'Settings' },
}

export default function DashboardV2({ setActiveTab }) {
  const { user } = useAuth()
  const { tier } = useTier()
  const [activePane, setActivePane] = useState('pulse')
  const [timeRange, setTimeRange] = useState('7d')

  // setActiveTab navigates the parent App's tab router — panes use it via
  // useNavigation() to deep-link to live tool pages (story-viewer etc.)
  const nav = { setActiveTab: setActiveTab || (() => {}) }

  return (
    <TrackedAccountProvider>
      <NavigationContext.Provider value={nav}>
        <DashboardLayout
          user={user}
          tier={tier}
          activePane={activePane}
          onPaneChange={setActivePane}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </NavigationContext.Provider>
    </TrackedAccountProvider>
  )
}
