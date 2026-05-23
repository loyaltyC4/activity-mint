/**
 * Competitors — tier-gated pro feature. Tracks public accounts the user
 * wants to watch (no following needed). Wires to competitor_tracking and
 * competitor_snapshots tables already in Supabase.
 *
 * Phase 2 scaffold with PRO badge + empty state.
 */

'use strict'

import React, { useEffect, useState } from 'react'
import { Globe, Plus, TrendingUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTier } from '../../../context/TierContext'
import { getCompetitors, addCompetitor, removeCompetitor } from '../../../lib/competitors'

function PaneHeader({ title, subtitle, badge }) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
      </div>
      {badge && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-500">{badge}</span>}
    </div>
  )
}

export default function CompetitorsPane({ timeRange }) {
  const { user } = useAuth()
  const { tier } = useTier()
  const isPaid = tier === 'standard' || tier === 'premium'

  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [handle, setHandle]   = useState('')
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    getCompetitors(user.id).then((rows) => {
      if (!cancelled) { setList(rows || []); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [user])

  async function onAdd(e) {
    e?.preventDefault?.()
    const clean = handle.trim().replace(/^@/, '')
    if (!clean) return
    setAdding(true)
    try {
      const row = await addCompetitor(user.id, clean)
      if (row) setList((l) => [...l, row])
      setHandle('')
    } catch (err) {
      alert(err.message || 'Failed to add')
    }
    setAdding(false)
  }

  async function onRemove(id) {
    await removeCompetitor(id)
    setList((l) => l.filter((c) => c.id !== id))
  }

  if (!isPaid) {
    return (
      <>
        <PaneHeader title="Competitors" subtitle="Watch any account, get alerts when they change" badge="PRO" />
        <div className="grid place-items-center rounded-3xl bg-white p-12 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-rose-100">
            <Globe className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold">Pro feature</h2>
          <p className="mt-2 max-w-sm text-sm text-[#64756f]">
            Watch up to 25 public Instagram accounts without following them. Get alerts when they post.
          </p>
          <Button className="mt-5 bg-teal-950 hover:bg-teal-900">Upgrade to unlock</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader title="Competitors" subtitle={`Tracking ${list.length}/25 — ${timeRange}`} badge="PRO" />

      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <form onSubmit={onAdd} className="flex gap-2">
            <Input
              placeholder="@username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={adding}
              className="flex-1"
            />
            <Button type="submit" disabled={adding || !handle.trim()} className="bg-teal-500 hover:bg-teal-600">
              <Plus className="-mt-px mr-1 inline h-4 w-4" />
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-teal-600" />
            <div className="text-base font-bold">Tracked accounts</div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0,1,2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-[#64756f]">No competitors tracked yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {list.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl bg-[#f0f4f3] p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-200 text-[15px] font-bold text-teal-700">
                      {c.username[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold">@{c.username}</div>
                      <div className="text-[11px] text-[#64756f]">Added {new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <button onClick={() => onRemove(c.id)} className="rounded-lg p-2 text-[#64756f] hover:bg-white hover:text-rose-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
