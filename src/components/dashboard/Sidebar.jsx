/**
 * Sidebar — Insight Flow design system.
 *
 * 228px fixed width, fills 100vh.
 * Tokens: brand teal, Inter Tight headings, JetBrains Mono labels.
 * Groups: Overview · Intelligence · Create · Grow · You
 * Badges: PRO (dark ink bg) · NEW (brand bg)
 * Active state: brand-soft bg + brand-ink text (no left-border)
 * Bottom upgrade card: dark ink card with brand CTA
 */

'use strict'

import React from 'react'
import {
  Home, Users, MessageSquare,
  LayoutGrid, PenTool, Megaphone,
  CalendarDays, Palette,
  TrendingUp, Phone, Wrench, Globe,
  Award, Settings as Cog,
  Zap, ChevronDown,
  MonitorPlay, Hash, UserMinus, UserCheck,
  Search, Link, Repeat2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AccountSwitcher from './shared/AccountSwitcher'

// ── Nav structure ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'pulse',     Icon: Home,          label: 'Pulse' },
      { id: 'audience',  Icon: Users,         label: 'Audience & Mood' },
      { id: 'sentiment', Icon: MessageSquare, label: 'Sentiment' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { id: 'content', Icon: LayoutGrid, label: 'Content Lab' },
      { id: 'script',  Icon: PenTool,   label: 'Script Studio', badge: 'pro' },
      { id: 'adlab',   Icon: Megaphone, label: 'Ad Intelligence', badge: 'new' },
    ],
  },
  {
    label: 'Create',
    items: [
      { id: 'planner',   Icon: CalendarDays, label: 'Next Post',        badge: 'new' },
      { id: 'templates', Icon: Palette,      label: 'Template Studio',  badge: 'new' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { id: 'trends',      Icon: TrendingUp, label: 'Trends & Insights', badge: 'new' },
      { id: 'outreach',    Icon: Phone,      label: 'Outreach Ideas' },
      { id: 'toolkit',     Icon: Wrench,     label: 'Tools' },
      { id: 'competitors', Icon: Globe,      label: 'Competitors', badge: 'pro' },
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

// ── Badge component ──────────────────────────────────────────────────────
function NavBadge({ type }) {
  if (type === 'pro') return (
    <span style={{
      background: 'var(--ink)',
      color: '#fff',
      fontSize: '9.5px',
      fontFamily: '"JetBrains Mono", monospace',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderRadius: '4px',
      padding: '2px 5px',
      lineHeight: 1,
    }}>PRO</span>
  )
  if (type === 'new') return (
    <span style={{
      background: 'var(--brand)',
      color: '#fff',
      fontSize: '9.5px',
      fontFamily: '"JetBrains Mono", monospace',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderRadius: '4px',
      padding: '2px 5px',
      lineHeight: 1,
    }}>NEW</span>
  )
  return null
}

// ── Nav item ─────────────────────────────────────────────────────────────
function NavItem({ id, Icon, label, badge, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        textAlign: 'left',
        padding: '7px 12px',
        margin: '1px 8px',
        width: 'calc(100% - 16px)',
        borderRadius: '7px',
        fontSize: '13.5px',
        fontWeight: active ? 500 : 450,
        fontFamily: 'Inter, ui-sans-serif, sans-serif',
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        border: 'none',
        background: active ? 'var(--brand-soft)' : 'transparent',
        color: active ? 'var(--brand-ink)' : 'oklch(0.5 0.01 240)',
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'oklch(0.97 0.003 240)'
          e.currentTarget.style.color = 'oklch(0.16 0.01 240)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'oklch(0.5 0.01 240)'
        }
      }}
    >
      <Icon
        style={{
          width: 15, height: 15, flexShrink: 0,
          color: active ? 'var(--brand)' : 'currentColor',
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <NavBadge type={badge} />}
    </button>
  )
}

// ── Brand area ───────────────────────────────────────────────────────────
function SidebarBrand() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '18px 16px 14px',
      borderBottom: '1px solid oklch(0.91 0.005 240)',
    }}>
      {/* Logo tile */}
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'var(--brand)',
        display: 'grid', placeItems: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 4px oklch(0.72 0.13 180 / 0.3)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.916a2 2 0 00-1.272 1.272L12 21l-1.912-5.812a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272L12 3z"/>
        </svg>
      </div>
      {/* Wordmark */}
      <div>
        <div style={{
          fontFamily: '"Inter Tight", Inter, sans-serif',
          fontSize: 15, fontWeight: 700,
          letterSpacing: '-0.3px',
          color: 'oklch(0.16 0.01 240)',
          lineHeight: 1.15,
        }}>Activity Mint</div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'oklch(0.5 0.01 240)',
          lineHeight: 1,
          marginTop: 2,
        }}>INTELLIGENCE</div>
      </div>
    </div>
  )
}

// ── Account switcher area ────────────────────────────────────────────────
function AccountArea({ user }) {
  const handle = user?.user_metadata?.tracked_handle || user?.email?.split('@')[0] || 'you'
  const initial = handle[0]?.toUpperCase() || 'A'

  return (
    <div style={{ margin: '10px 12px' }}>
      {/* Tracked account chip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'oklch(0.985 0.003 240)',
        borderRadius: 8, padding: '7px 10px',
        border: '1px solid oklch(0.91 0.005 240)',
        cursor: 'pointer',
      }}>
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--ink)',
          display: 'grid', placeItems: 'center',
          color: '#fff', fontSize: 11, fontWeight: 700,
          flexShrink: 0,
        }}>{initial}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'oklch(0.16 0.01 240)',
          }}>@{handle}</div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'oklch(0.5 0.01 240)',
          }}>Tracked</div>
        </div>
        <ChevronDown style={{ width: 13, height: 13, color: 'oklch(0.5 0.01 240)' }} />
      </div>

      {/* Full account switcher (existing component) */}
      <div style={{ marginTop: 6 }}>
        <AccountSwitcher compact />
      </div>
    </div>
  )
}

// ── Upgrade card ─────────────────────────────────────────────────────────
function UpgradeCard({ tier }) {
  const tierLabel = tier === 'standard' ? 'Solo-Hunter'
    : tier === 'premium' ? 'Pipeline Intercept'
    : 'Freemium'

  const nextTier = tier === 'premium' ? null
    : tier === 'standard' ? 'Pipeline Intercept'
    : 'Solo-Hunter'

  if (!nextTier) return null

  const price = tier === 'standard' ? '$149/mo' : '$39/mo'

  return (
    <div style={{
      margin: '10px 10px 16px',
      borderRadius: 10,
      background: 'oklch(0.14 0.015 185)',
      padding: '14px 14px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow blob */}
      <div style={{
        position: 'absolute', bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--brand)', filter: 'blur(30px)',
        opacity: 0.3, pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--brand)', marginBottom: 4,
        }}>{tierLabel} plan</div>

        <p style={{
          fontFamily: '"Inter Tight", Inter, sans-serif',
          fontSize: 12.5, fontWeight: 600, color: '#fff',
          lineHeight: 1.4, marginBottom: 10,
        }}>Unlock {nextTier}</p>

        <button
          onClick={() => window.location.href = '#pricing'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 5, width: '100%', padding: '8px 12px', borderRadius: 7,
            background: 'var(--brand)', color: 'oklch(0.16 0.01 240)',
            fontFamily: '"Inter Tight", Inter, sans-serif',
            fontSize: 11.5, fontWeight: 700, border: 'none', cursor: 'pointer',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Zap style={{ width: 12, height: 12 }} />
          Upgrade · {price}
        </button>
      </div>
    </div>
  )
}

// ── Main Sidebar ─────────────────────────────────────────────────────────
export default function Sidebar({ user, tier, activePane, onPaneChange }) {
  return (
    <aside style={{
      width: 228, flexShrink: 0,
      height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      background: '#fff',
      borderRight: '1px solid oklch(0.91 0.005 240)',
      scrollbarWidth: 'none',
    }}>
      <style>{`aside::-webkit-scrollbar { display: none; }`}</style>

      <SidebarBrand />
      <AccountArea user={user} />

      {/* Navigation */}
      <div style={{ flex: 1, padding: '4px 0' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            {/* Group label */}
            <div style={{
              padding: '10px 20px 4px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10.5, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'oklch(0.5 0.01 240)',
            }}>{group.label}</div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  {...item}
                  active={activePane === item.id}
                  onClick={onPaneChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <UpgradeCard tier={tier} />
    </aside>
  )
}
