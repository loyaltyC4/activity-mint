/**
 * DashboardSidebar — exact port of insight-flow's Sidebar.tsx
 * Adapted for Activity Mint's tab-based routing (no react-router).
 *
 * Changes vs. previous version:
 *   - Removed the redundant placeholder account button that duplicated AccountSwitcher
 *   - Fixed the "Pricing" entry that incorrectly shared id with "Next Post"
 *     (it now routes to id 'subscription' and is labeled accordingly)
 *   - Added a "Mood" entry in the Overview group as a companion to Audience
 */
'use strict'
import React from 'react'
import {
  Activity, Users, MessageSquare,
  LayoutGrid, FileCode, Megaphone,
  CalendarPlus, FileText,
  TrendingUp, Phone, Wrench, Globe,
  Award, Settings, Sparkles, Smile, CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AccountSwitcher from './shared/AccountSwitcher'

const groups = [
  {
    label: 'Overview',
    items: [
      { id: 'pulse',     label: 'Pulse',            Icon: Activity },
      { id: 'audience',  label: 'Audience',         Icon: Users },
      { id: 'mood',      label: 'Mood',             Icon: Smile, badge: 'NEW' },
      { id: 'sentiment', label: 'Sentiment',        Icon: MessageSquare },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'content', label: 'Content Lab',     Icon: LayoutGrid },
      { id: 'script',  label: 'Script Studio',   Icon: FileCode,   badge: 'PRO' },
      { id: 'adlab',   label: 'Ad Intelligence', Icon: Megaphone,  badge: 'NEW' },
    ],
  },
  {
    label: 'Create',
    items: [
      { id: 'planner',   label: 'Next Post',        Icon: CalendarPlus, badge: 'NEW' },
      { id: 'templates', label: 'Template Studio',  Icon: FileText,     badge: 'NEW' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { id: 'trends',      label: 'Trends & Insights', Icon: TrendingUp, badge: 'NEW' },
      { id: 'outreach',    label: 'Outreach Ideas',    Icon: Phone },
      { id: 'toolkit',     label: 'Tools',             Icon: Wrench },
      { id: 'competitors', label: 'Competitors',       Icon: Globe,      badge: 'PRO' },
    ],
  },
  {
    label: 'You',
    items: [
      { id: 'rewards',      label: 'Rewards',      Icon: Award },
      { id: 'subscription', label: 'Subscription', Icon: CreditCard },
      { id: 'settings',     label: 'Settings',     Icon: Settings },
    ],
  },
]

export default function DashboardSidebar({ user, tier, activePane, onPaneChange }) {
  const tierLabel = tier === 'premium' ? 'Pipeline Intercept'
    : tier === 'standard' ? 'Solo-Hunter'
    : 'Freemium'

  const nextTier = tier === 'premium' ? null
    : tier === 'standard' ? 'Pipeline Intercept'
    : 'Solo-Hunter'

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-hairline bg-surface-2/40 backdrop-blur-sm sticky top-0 h-screen">

      {/* Brand area — h-16 exactly */}
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-hairline">
        <div className="size-8 rounded-lg grid place-items-center relative overflow-hidden bg-foreground">
          <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-ink opacity-90" />
          <Sparkles className="size-4 text-white relative z-10" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display font-bold text-[15px] tracking-tight">Activity Mint</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Intelligence</span>
        </div>
      </div>

      {/* Account switcher — single control, no duplicate button */}
      <div className="px-3 py-3 border-b border-hairline">
        <AccountSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" style={{ scrollbarWidth: 'none' }}>
        <style>{`nav::-webkit-scrollbar{display:none}`}</style>
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-2 mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = activePane === item.id
                const { Icon } = item
                return (
                  <button
                    key={`${item.id}-${item.label}`}
                    onClick={() => onPaneChange(item.id)}
                    className={cn(
                      'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all relative w-full text-left',
                      active
                        ? 'bg-brand-soft text-brand-ink'
                        : 'text-foreground/70 hover:text-foreground hover:bg-foreground/[0.03]'
                    )}
                  >
                    {active && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-brand rounded-r" />
                    )}
                    <Icon
                      className={cn('size-[15px] shrink-0', active ? 'text-brand' : '')}
                      strokeWidth={1.75}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded',
                        item.badge === 'PRO'
                          ? 'bg-amber/15 text-amber'
                          : 'bg-brand-soft text-brand-ink'
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade card */}
      {nextTier && (
        <div className="p-3 border-t border-hairline">
          <button
            onClick={() => onPaneChange('subscription')}
            className="w-full block p-4 rounded-xl bg-foreground text-white relative overflow-hidden group text-left"
          >
            <div className="absolute -top-12 -right-8 size-32 rounded-full bg-brand/40 blur-2xl group-hover:bg-brand/60 transition-colors" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="size-1.5 rounded-full bg-brand animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/60">{tierLabel}</span>
              </div>
              <p className="text-sm font-display font-semibold mb-3 leading-tight">Unlock {nextTier}</p>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="px-2 py-1 bg-brand text-foreground rounded-md font-semibold">Upgrade</span>
                <span className="text-white/50">
                  {tier === 'standard' ? 'from $149/mo' : 'from $39/mo'}
                </span>
              </div>
            </div>
          </button>
        </div>
      )}
    </aside>
  )
}
