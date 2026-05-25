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
import DashboardLayout from './DashboardLayout'
import { NavigationContext } from './NavigationContext'

// Pane IDs match the spark-insights design nav structure (10 panes / 3 groups)
export const PANES = {
  // Overview
  pulse:       { group: 'Overview', label: 'Pulse' },
  audience:    { group: 'Overview', label: 'Audience & Mood' },
  content:     { group: 'Overview', label: 'Content Lab' },
  script:      { group: 'Overview', label: 'Script Studio', badge: 'pro' },
  sentiment:   { group: 'Overview', label: 'Sentiment' },
  // Growth
  trends:      { group: 'Growth',   label: 'Trends & Insights', badge: 'new' },
  adlab:       { group: 'Growth',   label: 'Ad Lab', badge: 'new' },
  outreach:    { group: 'Growth',   label: 'Outreach Ideas' },
  toolkit:     { group: 'Growth',   label: 'Tools' },
  competitors: { group: 'Growth',   label: 'Competitors', badge: 'pro' },
  // You
  rewards:     { group: 'You',      label: 'Rewards' },
  settings:    { group: 'You',      label: 'Settings' },
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
  )
}
