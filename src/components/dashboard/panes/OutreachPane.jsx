/**
 * Outreach Ideas — 1:1 port of insight-flow's outreach.tsx
 * Icon swaps: Phone → PhoneCall, MessageSquare → MessageCircle, Users → Contact, Sparkles → Wand2
 */
'use strict'

import React, { useState } from 'react'
import {
  PhoneCall,
  MessageCircle,
  Send,
  Wand2,
  Filter,
  Mail,
  Copy,
  Check,
  ArrowRight,
  Contact,
  ExternalLink,
} from 'lucide-react'
import SectionCard from '../shared/SectionCard'

const leads = [
  { handle: '@nicheventures',  name: 'Nina Chen',    followers: '84.2K',  overlap: 92, signal: 'Saved 3 of your posts last week',            warmth: 'hot' },
  { handle: '@bootstrap.daily', name: 'Marcus Hill',  followers: '212K',   overlap: 78, signal: 'Commented "This is gold" on your reel',     warmth: 'hot' },
  { handle: '@solopreneur.co',  name: 'Aisha Reyes',  followers: '44.8K',  overlap: 71, signal: 'Followed after viewing 6 stories',          warmth: 'warm' },
  { handle: '@buildinpublic',   name: 'Tomás Reed',   followers: '127K',   overlap: 64, signal: 'Re-shared your carousel to story',          warmth: 'warm' },
  { handle: '@cashflow.club',   name: 'Hana Park',    followers: '58.1K',  overlap: 52, signal: 'DM-opened the offer announcement',          warmth: 'cool' },
]

const templates = [
  {
    label: 'Soft-open · referencing their post',
    body:  'Hey {firstName} — your carousel on {topic} last Tuesday was the cleanest take I\'ve seen all week. I\'m building something adjacent and wanted to share a 90-second walkthrough — would you be down to look?',
  },
  {
    label: 'Value-first · drop a frame',
    body:  'Saw your reel on {topic}. The 3-cut intro inspired me to rebuild ours — landed a 2.4x save lift overnight. Sending you a quick teardown of what we copied, no ask.',
  },
  {
    label: 'Trade · creator-to-creator',
    body:  'Quick one — your audience overlap with ours is at 92% on the founder-mode tag. Would you want to trade a reel slot? I\'ll post yours first, no strings.',
  },
]

export default function OutreachPane() {
  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Outreach Ideas
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            We surface accounts who already engaged with you, score the warmth, and draft the first message in your voice. Hit send.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ring-1 ring-foreground/10 text-xs font-medium hover:bg-foreground/[0.04]">
            <Filter className="size-3.5" strokeWidth={2} /> Hot · 24
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all">
            <Wand2 className="size-3.5" strokeWidth={2.25} /> Refresh leads
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SectionCard
            title="High-intent leads"
            subtitle="Sorted by warmth + audience overlap"
            icon={<Contact className="size-4" strokeWidth={2} />}
          >
            <div className="space-y-2">
              {leads.map((l, i) => (
                <LeadRow key={l.handle} lead={l} highlight={i === 0} />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <Composer />
        </div>
      </div>

      <SectionCard
        title="Message templates"
        subtitle="Plug-and-play with auto-fill from the selected lead"
        icon={<MessageCircle className="size-4" strokeWidth={2} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t, i) => (
            <div
              key={i}
              className="p-4 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50 hover:bg-card hover:shadow-pop transition-all flex flex-col"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-brand-ink bg-brand-soft px-2 py-0.5 rounded self-start mb-3">
                Template {String(i + 1).padStart(2, '0')}
              </div>
              <div className="text-sm font-display font-semibold tracking-tight mb-2">{t.label}</div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{t.body}</p>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-hairline">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-foreground text-white text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all">
                  Use template <ArrowRight className="size-3" />
                </button>
                <button
                  aria-label="Copy template"
                  className="size-8 rounded-md ring-1 ring-foreground/10 grid place-items-center hover:bg-foreground/[0.04]"
                >
                  <Copy className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  )
}

function LeadRow({ lead, highlight }) {
  const warmthMap = {
    hot:  { bg: 'bg-negative/10',  text: 'text-negative',  dot: 'bg-negative' },
    warm: { bg: 'bg-amber/10',     text: 'text-amber',     dot: 'bg-amber' },
    cool: { bg: 'bg-brand-soft',   text: 'text-brand-ink', dot: 'bg-brand' },
  }[lead.warmth]

  return (
    <div
      className={`group flex items-center gap-4 p-3 rounded-xl transition-all ${
        highlight ? 'ring-1 ring-brand bg-brand-soft/30' : 'hover:bg-foreground/[0.03]'
      }`}
    >
      <div className="size-11 rounded-full bg-gradient-to-br from-foreground via-brand-ink to-brand grid place-items-center text-white font-display font-bold text-sm shrink-0">
        {lead.name.split(' ').map((s) => s[0]).join('')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight truncate">{lead.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{lead.handle}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${warmthMap.bg} ${warmthMap.text} flex items-center gap-1`}>
            <span className={`size-1.5 rounded-full ${warmthMap.dot} animate-pulse`} /> {lead.warmth}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{lead.signal}</div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-[10px] font-mono text-muted-foreground">overlap</div>
        <div className="text-sm font-bold tabular-nums text-brand-ink">{lead.overlap}%</div>
      </div>
      <div className="flex items-center gap-1">
        <button
          aria-label="DM"
          className="size-8 rounded-md ring-1 ring-foreground/10 grid place-items-center hover:bg-foreground/[0.04]"
        >
          <MessageCircle className="size-3.5" />
        </button>
        <button
          aria-label="Email"
          className="size-8 rounded-md ring-1 ring-foreground/10 grid place-items-center hover:bg-foreground/[0.04]"
        >
          <Mail className="size-3.5" />
        </button>
        <button className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-foreground text-white text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all">
          <Send className="size-3" /> Draft
        </button>
      </div>
    </div>
  )
}

function Composer() {
  const [copied, setCopied] = useState(false)
  const msg =
    'Hey Nina — your carousel on offer creation last Tuesday was the cleanest take I\'ve seen all week. I\'m building something adjacent (Activity Mint — intelligence for solo founders) and wanted to share a 90-second walkthrough. Would you be down to look?'

  return (
    <SectionCard
      title="Compose · @nicheventures"
      subtitle="Draft pre-filled from selected lead"
      icon={<Send className="size-4" strokeWidth={2} />}
      action={
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-positive bg-positive/10 px-2 py-1 rounded">
          Voice-matched
        </span>
      }
    >
      <div className="p-4 rounded-xl bg-surface-2/60 ring-1 ring-foreground/[0.06] mb-4">
        <p className="text-sm leading-relaxed text-foreground/90">{msg}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(msg)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="py-2.5 rounded-lg ring-1 ring-foreground/10 hover:bg-foreground/[0.04] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-positive" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
        <button className="py-2.5 rounded-lg ring-1 ring-foreground/10 hover:bg-foreground/[0.04] text-xs font-semibold flex items-center justify-center gap-1.5">
          <Wand2 className="size-3.5" /> Regenerate
        </button>
      </div>
      <button className="w-full py-3 bg-foreground text-white rounded-xl font-semibold text-sm hover:bg-brand hover:text-foreground transition-all flex items-center justify-center gap-2 group">
        <Send className="size-4" strokeWidth={2.25} /> Send via Instagram DM
        <ExternalLink className="size-3.5 opacity-60 group-hover:opacity-100" />
      </button>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button className="py-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] flex items-center justify-center gap-1.5">
          <Mail className="size-3" /> Email instead
        </button>
        <button className="py-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] flex items-center justify-center gap-1.5">
          <PhoneCall className="size-3" /> Schedule call
        </button>
      </div>
    </SectionCard>
  )
}
