/**
 * AccountSwitcher — dropdown to add/switch tracked Instagram handles.
 *
 * Renders in the sidebar ProfileCard area. Shows the current handle
 * with a chevron; click to expand a list of all tracked accounts +
 * an inline "Add account" input.
 */

'use strict'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Check, Loader2, AtSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'

export default function AccountSwitcher() {
  const { handle, setHandle, accounts, addAccount, loading } = useTrackedAccount()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAdd = async () => {
    if (!newUsername.trim()) return
    setSubmitting(true)
    const ok = await addAccount(newUsername)
    setSubmitting(false)
    if (ok) {
      setNewUsername('')
      setAdding(false)
      setOpen(false)
    }
  }

  if (loading) return null

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors',
          'hover:bg-slate-50',
          open && 'bg-slate-50'
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-[11px] font-extrabold text-white">
          {(handle || '?')[0].toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-[12px] font-bold text-slate-800">@{handle || 'none'}</div>
          <div className="text-[10px] text-slate-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''} tracked</div>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl bg-white p-1.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.2)] border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Account list */}
          <div className="max-h-48 overflow-y-auto">
            {accounts.map((acc) => (
              <button
                key={acc.id || acc.username}
                onClick={() => { setHandle(acc.username); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors',
                  acc.username === handle
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                  {acc.username[0].toUpperCase()}
                </span>
                <span className="flex-1 truncate">@{acc.username}</span>
                {acc.username === handle && <Check className="h-3.5 w-3.5 text-teal-600" />}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="my-1.5 border-t border-slate-100" />

          {/* Add account */}
          {adding ? (
            <div className="flex items-center gap-1.5 px-1">
              <div className="relative flex-1">
                <AtSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <input
                  autoFocus
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="username"
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-[12px] focus:border-teal-400 focus:outline-none"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={submitting || !newUsername.trim()}
                className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setNewUsername('') }}
                className="rounded-lg px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-teal-600 hover:bg-teal-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add account
            </button>
          )}
        </div>
      )}
    </div>
  )
}
