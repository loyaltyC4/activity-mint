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

// Pane IDs match the spark-insights design nav structure (10 panes / 3 groups)
export const PANES = {
  // Overview
  pulse:       { group: 'Overview', label: 'Pulse' },
  audience:    { group: 'Overview', label: 'Audience & Mood' },
  content:     { group: 'Overview', label: 'Content Lab' },
  sentiment:   { group: 'Overview', label: 'Sentiment' },
  // Growth
  trends:      { group: 'Growth',   label: 'Trends & Insights', badge: 'new' },
  outreach:    { group: 'Growth',   label: 'Outreach Ideas' },
  toolkit:     { group: 'Growth',   label: 'Free Tools' },
  competitors: { group: 'Growth',   label: 'Competitors', badge: 'pro' },
  // You
  rewards:     { group: 'You',      label: 'Rewards' },
  settings:    { group: 'You',      label: 'Settings' },
}

export default function DashboardV2() {
  const { user } = useAuth()
  const { tier } = useTier()
  const [activePane, setActivePane] = useState('pulse')
  const [timeRange, setTimeRange] = useState('7d')

  return (
    <DashboardLayout
      user={user}
      tier={tier}
      activePane={activePane}
      onPaneChange={setActivePane}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
    />
  )
}
