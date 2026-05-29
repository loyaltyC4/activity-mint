/**
 * Settings — designed in insight-flow style (no upstream source)
 * Icon swap: Settings (sidebar) → SlidersHorizontal in pane to avoid Vite chunk collision
 */
'use strict'

import React, { useState } from 'react'
import {
  SlidersHorizontal,
  User,
  CreditCard,
  Bell,
  Plug,
  Lock,
  ChevronRight,
  Check,
  Instagram,
  Mail,
  Bot,
  KeyRound,
  ArrowUpRight,
  Wand2,
  CircleAlert,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const account = {
  name:   'Tobias Bennett',
  email:  'tobias@activity-mint.co',
  handle: '@activitymint',
  tier:   'Solo Hunter',
}

const connections = [
  { name: 'Instagram',   detail: '@activitymint · 8.4K followers',   status: 'connected', icon: Instagram },
  { name: 'Gmail',       detail: 'tobias@activity-mint.co',          status: 'connected', icon: Mail },
  { name: 'Slack',       detail: '#alerts in mint-hq workspace',     status: 'connected', icon: Bot },
  { name: 'TikTok',      detail: 'Not connected',                    status: 'idle',      icon: Plug },
]

const notificationDefaults = [
  { key: 'gap',   label: 'Competitor gap alerts',    desc: 'Ping me when a tracked account adopts a new format.', on: true },
  { key: 'trend', label: 'Trending format ready',     desc: 'Surface heat-ranked formats as soon as they hit my baseline.', on: true },
  { key: 'lead',  label: 'High-warmth lead surfaced', desc: 'Email when a lead scores ≥ 85% audience overlap.', on: true },
  { key: 'roll',  label: 'Weekly roll-up',            desc: 'Sunday email with the week\'s wins and skips.', on: false },
]

export default function SettingsPane() {
  const [tab, setTab] = useState('account')
  const [notifs, setNotifs] = useState(notificationDefaults)

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Account, integrations, notifications, and the quiet knobs that make Activity Mint feel like yours.
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
          <Wand2 className="size-3.5" strokeWidth={2.25} /> Save changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar nav */}
        <aside className="lg:col-span-1">
          <nav className="space-y-1">
            {[
              { id: 'account',       label: 'Account',       icon: User },
              { id: 'billing',       label: 'Billing',       icon: CreditCard },
              { id: 'connections',   label: 'Connections',   icon: Plug },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'security',      label: 'Security',      icon: Lock },
              { id: 'preferences',   label: 'Preferences',   icon: SlidersHorizontal },
            ].map((n) => {
              const Icon = n.icon
              const active = tab === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-foreground text-white shadow-pop'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]'
                  }`}
                >
                  <Icon className="size-3.5" strokeWidth={2} />
                  <span className="flex-1 text-left">{n.label}</span>
                  {active && <ChevronRight className="size-3.5" />}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Panel */}
        <div className="lg:col-span-4 space-y-6">
          {tab === 'account' && <AccountPanel />}
          {tab === 'billing' && <BillingPanel />}
          {tab === 'connections' && <ConnectionsPanel />}
          {tab === 'notifications' && (
            <NotificationsPanel notifs={notifs} setNotifs={setNotifs} />
          )}
          {tab === 'security' && <SecurityPanel />}
          {tab === 'preferences' && <PreferencesPanel />}
        </div>
      </div>

      <SectionCard tone="ink">
        <div className="absolute -top-12 -right-12 size-56 bg-negative/30 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CircleAlert className="size-4 text-negative" />
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-negative">Danger zone</span>
            </div>
            <h3 className="font-display font-bold text-2xl tracking-tight leading-tight text-white">
              Pause or delete this workspace
            </h3>
            <p className="text-sm text-white/60 mt-2 max-w-2xl">
              Pausing stops scraping and freezes your tier. Deleting wipes saved scripts, leads, and history. Both are reversible within 14 days.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="px-4 py-2.5 rounded-xl ring-1 ring-white/15 text-white text-sm font-semibold hover:bg-white/[0.06] transition-all">
              Pause workspace
            </button>
            <button className="px-4 py-2.5 rounded-xl bg-negative text-white text-sm font-semibold hover:bg-negative/90 transition-all">
              Delete
            </button>
          </div>
        </div>
      </SectionCard>
    </>
  )
}

function Field({ label, value, hint }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input
        defaultValue={value}
        className="mt-1.5 w-full bg-surface-2/60 ring-1 ring-foreground/[0.06] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-brand transition-all"
      />
      {hint && <span className="text-[11px] text-muted-foreground mt-1 block">{hint}</span>}
    </label>
  )
}

function AccountPanel() {
  return (
    <SectionCard
      title="Account"
      subtitle="The basics that show up everywhere"
      icon={<User className="size-4" strokeWidth={2} />}
    >
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-hairline">
        <div className="size-16 rounded-full bg-gradient-to-br from-foreground via-brand-ink to-brand grid place-items-center text-white font-display font-bold text-xl">
          TB
        </div>
        <div>
          <div className="font-display font-semibold text-lg tracking-tight">{account.name}</div>
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
            {account.handle} · {account.tier}
          </div>
          <button className="mt-2 text-[11px] font-semibold text-brand-ink hover:underline">
            Change avatar
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Display name" value={account.name} />
        <Field label="Handle"       value={account.handle} hint="Used in scraping pipelines & referral links" />
        <Field label="Email"        value={account.email} />
        <Field label="Timezone"     value="Europe/London" />
      </div>
    </SectionCard>
  )
}

function BillingPanel() {
  return (
    <SectionCard
      title="Billing · Solo Hunter"
      subtitle="$39 / month · renews June 28"
      icon={<CreditCard className="size-4" strokeWidth={2} />}
      action={
        <button className="text-[11px] font-semibold text-brand-ink hover:underline flex items-center gap-1">
          Upgrade to Pipeline Intercept <ArrowUpRight className="size-3" />
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'This cycle',    value: '$39.00',  hint: '8 days remaining' },
          { label: 'Tracked accts', value: '4 / 8',   hint: 'Slots used' },
          { label: 'Script runs',   value: '128',     hint: 'Cap: unlimited' },
        ].map((m) => (
          <div key={m.label} className="p-4 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/60">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{m.label}</div>
            <div className="font-display font-bold text-2xl tabular-nums mt-1">{m.value}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{m.hint}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
        Recent invoices
      </div>
      <div className="space-y-1">
        {[
          { id: 'INV-0428', date: 'Apr 28, 2026', amount: '$39.00', status: 'Paid' },
          { id: 'INV-0328', date: 'Mar 28, 2026', amount: '$39.00', status: 'Paid' },
          { id: 'INV-0228', date: 'Feb 28, 2026', amount: '$39.00', status: 'Paid' },
        ].map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-[11px] font-mono text-muted-foreground w-24">{i.id}</div>
              <div className="text-sm font-medium">{i.date}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums">{i.amount}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-positive/10 text-positive">
                {i.status}
              </span>
              <button className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ConnectionsPanel() {
  return (
    <SectionCard
      title="Connections"
      subtitle="Channels Activity Mint reads from and writes to"
      icon={<Plug className="size-4" strokeWidth={2} />}
    >
      <div className="space-y-2">
        {connections.map((c) => {
          const Icon = c.icon
          const connected = c.status === 'connected'
          return (
            <div
              key={c.name}
              className="flex items-center gap-4 p-3 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50 hover:bg-card transition-colors"
            >
              <div className="size-10 rounded-lg bg-gradient-to-br from-foreground/5 to-foreground/10 grid place-items-center">
                <Icon className="size-4" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-display font-semibold tracking-tight">{c.name}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">{c.detail}</div>
              </div>
              {connected ? (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-positive/10 text-positive flex items-center gap-1">
                  <Check className="size-2.5" strokeWidth={3} /> Connected
                </span>
              ) : (
                <button className="px-3 py-1.5 rounded-md bg-foreground text-white text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all">
                  Connect
                </button>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

function NotificationsPanel({ notifs, setNotifs }) {
  return (
    <SectionCard
      title="Notifications"
      subtitle="The quiet rules that decide what reaches you"
      icon={<Bell className="size-4" strokeWidth={2} />}
    >
      <div className="space-y-1">
        {notifs.map((n) => (
          <div
            key={n.key}
            className="flex items-start justify-between gap-4 p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-display font-semibold tracking-tight">{n.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.desc}</div>
            </div>
            <button
              onClick={() => setNotifs(notifs.map((x) => (x.key === n.key ? { ...x, on: !x.on } : x)))}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                n.on ? 'bg-brand' : 'bg-foreground/15'
              }`}
              aria-pressed={n.on}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                  n.on ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function SecurityPanel() {
  return (
    <SectionCard
      title="Security"
      subtitle="Sessions, keys, and the boring-but-important stuff"
      icon={<Lock className="size-4" strokeWidth={2} />}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50">
          <div>
            <div className="text-sm font-display font-semibold tracking-tight">Two-factor authentication</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Authenticator app · last verified 4 days ago</div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-positive/10 text-positive">
            On
          </span>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50">
          <div>
            <div className="text-sm font-display font-semibold tracking-tight flex items-center gap-1.5">
              <KeyRound className="size-3.5" /> API keys
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">2 active keys · last used 6h ago</div>
          </div>
          <button className="px-3 py-1.5 rounded-md ring-1 ring-foreground/10 text-[11px] font-semibold hover:bg-foreground/[0.04]">
            Manage
          </button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50">
          <div>
            <div className="text-sm font-display font-semibold tracking-tight">Active sessions</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">3 devices · London, Berlin, iPhone</div>
          </div>
          <button className="px-3 py-1.5 rounded-md ring-1 ring-foreground/10 text-[11px] font-semibold hover:bg-foreground/[0.04]">
            Review
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

function PreferencesPanel() {
  return (
    <SectionCard
      title="Preferences"
      subtitle="Make Activity Mint feel like yours"
      icon={<SlidersHorizontal className="size-4" strokeWidth={2} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Default landing pane" value="Pulse" hint="Where you land after sign-in" />
        <Field label="Voice profile"        value="Founder · plainspoken" />
        <Field label="Brand color"          value="Brand teal" />
        <Field label="Reporting cadence"    value="Weekly · Mondays" />
      </div>
      <div className="mt-6 pt-6 border-t border-hairline">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Beta features
        </div>
        <div className="space-y-2">
          {[
            { label: 'Voice clone for VO drafts', on: true },
            { label: 'Real-time competitor diffing', on: false },
            { label: 'Auto-DM responder (read-only)', on: false },
          ].map((b) => (
            <div key={b.label} className="flex items-center justify-between p-3 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50">
              <div className="text-sm font-medium">{b.label}</div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  b.on ? 'bg-brand-soft text-brand-ink' : 'bg-foreground/[0.05] text-muted-foreground'
                }`}
              >
                {b.on ? 'Enabled' : 'Try it'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
