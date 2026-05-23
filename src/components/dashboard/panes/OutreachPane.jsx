/**
 * Outreach Ideas — who to target, split into two groups:
 *   1. Your own fanbase super-engagers (people you already know want more)
 *   2. Demographic matches (people who fit your audience profile)
 *
 * Each row offers a Message button that opens a Sheet with a draft DM.
 * Phase 2 scaffold; Phase 5 wires real follower/engagement analysis.
 */

'use strict'

import React, { useState } from 'react'
import { Phone, Send, Sparkles, MessageSquare } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

const FANBASE = [
  { handle: 'sunset_clara',   note: '12 comments this month', badge: 'hot',  color: 'coral'  },
  { handle: 'designwit',      note: 'Shared 4 of your reels', badge: 'warm', color: 'amber'  },
  { handle: 'studio.notes',   note: 'Saved 9 posts',          badge: 'warm', color: 'amber'  },
]
const DEMOGRAPHIC = [
  { handle: 'morning_brew_co', note: 'Same niche, 12k followers', badge: 'new', color: 'teal'   },
  { handle: 'photo_pulse',     note: 'Overlaps with 23 of your fans', badge: 'new', color: 'teal' },
  { handle: 'craft.cobblestone', note: 'Posts 3x/week — engaged audience', badge: 'new', color: 'teal' },
]

const BADGE_STYLE = {
  hot:  'bg-rose-50 text-rose-500',
  warm: 'bg-amber-50 text-amber-500',
  new:  'bg-teal-50 text-teal-600',
}
const AVATAR_BG = {
  coral:  'bg-rose-200 text-rose-700',
  amber:  'bg-amber-200 text-amber-700',
  teal:   'bg-teal-200 text-teal-700',
  violet: 'bg-violet-200 text-violet-700',
}

function Row({ row, onMessage }) {
  const initial = row.handle[0]?.toUpperCase() || '?'
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f0f4f3] p-3">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold ${AVATAR_BG[row.color] || AVATAR_BG.teal}`}>
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold">@{row.handle}</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${BADGE_STYLE[row.badge]}`}>
            {row.badge}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-[#64756f]">{row.note}</div>
      </div>
      <button
        onClick={() => onMessage(row)}
        className="ml-auto inline-flex items-center gap-1 rounded-[9px] border border-[#e0eae7] bg-white px-3 py-1.5 text-[11px] font-semibold text-foreground hover:border-teal-500 hover:text-teal-600"
      >
        <MessageSquare className="h-3 w-3" />
        Draft DM
      </button>
    </div>
  )
}

function DraftDrawer({ row, open, onOpenChange }) {
  const [draft, setDraft] = useState('')
  React.useEffect(() => {
    if (row) {
      setDraft(`Hey @${row.handle} — just saw your recent post and loved it. Wanted to share a quick thought from our side and see if you'd be open to a quick chat.`)
    }
  }, [row])
  if (!row) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Draft for @{row.handle}
          </SheetTitle>
          <SheetDescription>{row.note}</SheetDescription>
        </SheetHeader>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-5 w-full rounded-2xl border border-[#e0eae7] bg-white p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500"
          rows={8}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(draft).catch(() => {})}
            className="rounded-[10px] border border-[#e0eae7] bg-white px-4 py-2 text-xs font-semibold hover:border-teal-500"
          >
            Copy
          </button>
          <button
            className="rounded-[10px] bg-teal-500 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600"
            onClick={() => alert('Open in Instagram DM — coming in Phase 5')}
          >
            Open in Instagram
          </button>
        </div>
        <p className="mt-4 text-xs text-[#64756f]">
          Drafts use a friendly opener. Edit before sending — personalization wins.
        </p>
      </SheetContent>
    </Sheet>
  )
}

export default function OutreachPane({ timeRange }) {
  const [openRow, setOpenRow] = useState(null)
  return (
    <>
      <PaneHeader title="Outreach Ideas" subtitle={`Where to focus your DMs this ${timeRange}`} />
      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-3.5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold">From your own fanbase</div>
              <div className="text-xs text-[#64756f]">People who already engage — most likely to convert</div>
            </div>
          </div>
          <div className="space-y-2">
            {FANBASE.map((r) => <Row key={r.handle} row={r} onMessage={setOpenRow} />)}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-3.5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold">Audience matches</div>
              <div className="text-xs text-[#64756f]">Accounts in your niche with overlapping fans</div>
            </div>
          </div>
          <div className="space-y-2">
            {DEMOGRAPHIC.map((r) => <Row key={r.handle} row={r} onMessage={setOpenRow} />)}
          </div>
        </div>
      </div>

      <DraftDrawer row={openRow} open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)} />
      <p className="mt-4 text-xs text-[#64756f]">Targets are placeholders — Phase 5 wires to real follower + comment scoring.</p>
    </>
  )
}
