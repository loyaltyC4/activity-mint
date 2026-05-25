/**
 * Sticky sidebar — 3 nav groups, profile card, upsell card.
 * Updated to include Script Studio, Ad Lab, and Next Post planner.
 */

'use strict'

import React from 'react'
import {
  Home, Users, LayoutGrid, MessageSquare,
  TrendingUp, Phone, Wrench, Globe,
  Award, Settings as Cog, Sparkles,
  PenTool, Megaphone, CalendarDays, Palette,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'pulse',     Icon: Home,          label: 'Pulse' },
      { id: 'audience',  Icon: Users,         label: 'Audience & Mood' },
      { id: 'content',   Icon: LayoutGrid,    label: 'Content Lab' },
      { id: 'script',    Icon: PenTool,       label: 'Script Studio', badge: 'pro' },
      { id: 'sentiment', Icon: MessageSquare, label: 'Sentiment' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { id: 'planner',     Icon: CalendarDays, label: 'Next Post',         badge: 'new' },
      { id: 'templates',   Icon: Palette,      label: 'Template Studio',   badge: 'new' },
      { id: 'adlab',       Icon: Megaphone,    label: 'Ad Lab',            badge: 'new' },
      { id: 'trends',      Icon: TrendingUp,   label: 'Trends & Insights', badge: 'new' },
      { id: 'outreach',    Icon: Phone,        label: 'Outreach Ideas' },
      { id: 'toolkit',     Icon: Wrench,       label: 'Tools' },
      { id: 'competitors', Icon: Globe,        label: 'Competitors', badge: 'pro' },
    ],
  },
  {
    label: 'You',
    items: [
      { id: 'rewards',  Icon: Award, label: 'Rewards' },
      { id: 'settings', Icon: Cog,   label: 'Settings' },
    ],
  },
]

function ProfileCard({ user, tier }) {
  const handle  = user?.user_metadata?.tracked_handle || user?.email?.split('@')[0] || 'admin'
  const initial = handle[0]?.toUpperCase() || 'A'
  const subtitle = tier === 'premium' ? 'Creator · Premium'
    : tier === 'standard' ? 'Creator · Standard'
    : 'Creator · Free plan'

  return (
    <div className="mb-3.5 flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-teal-500 to-teal-950 text-[15px] font-extrabold text-white shadow-[0_0_0_1px_rgba(20,184,166,0.3)]">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold">@{handle}</div>
        <div className="text-[11px] text-[#64756f]">{subtitle}</div>
      </div>
    </div>
  )
}

function UpsellCard() {
  return (
    <div className="mt-auto pt-3.5">
      <div className="rounded-2xl bg-gradient-to-br from-violet-100 to-teal-50 p-3.5 shadow-[0_0_0_1px_rgba(124,58,237,0.18)]">
        <div className="mb-1 flex items-center gap-1 text-[13px] font-bold">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          Go Mint Pro
        </div>
        <p className="mb-2.5 text-[11.5px] leading-[1.45] text-[#64756f]">
          Script Studio, Ad Lab, competitor tracking, full AI + email alerts.
        </p>
        <button className="w-full rounded-[11px] bg-teal-950 py-2 text-xs font-semibold text-white transition-transform hover:scale-[1.02]">
          Upgrade — $9/mo
        </button>
      </div>
    </div>
  )
}

function NavItem({ id, Icon, label, badge, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all',
        active
          ? 'bg-teal-50 text-teal-600 shadow-[0_0_0_1px_rgba(20,184,166,0.28)]'
          : 'bg-transparent text-[#64756f] hover:bg-[#f0f4f3] hover:text-foreground'
      )}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" />
      <span className="flex-1">{label}</span>
      {badge === 'pro' && (
        <span className="ml-auto inline-flex items-center rounded-[5px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
          PRO
        </span>
      )}
      {badge === 'new' && (
        <span className="ml-auto inline-flex items-center rounded-[5px] bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-600">
          New
        </span>
      )}
    </button>
  )
}

export default function Sidebar({ user, tier, activePane, onPaneChange }) {
  const isPaid = tier === 'standard' || tier === 'premium'

  return (
    <aside className="sticky top-[53px] hidden h-[calc(100vh-53px)] w-64 shrink-0 flex-col border-r border-[#e0eae7]/70 bg-white/45 p-3.5 lg:flex">
      <ProfileCard user={user} tier={tier} />

      <ScrollArea className="flex-1 -mr-3.5 pr-3.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#64756f]">
              {group.label}
            </div>
            <nav className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  {...item}
                  active={activePane === item.id}
                  onClick={onPaneChange}
                />
              ))}
            </nav>
          </div>
        ))}
      </ScrollArea>

      {!isPaid && <UpsellCard />}
    </aside>
  )
}
