/**
 * AccountSwitcher — restyled in insight-flow / Activity Mint design language.
 *
 * Lives in the sidebar header. Click the trigger to expand a list of all
 * watched accounts. Each row has a Remove (trash) button that lifts the
 * account out of the watch list after a one-click confirm. An inline
 * "Add account" input lets the user start watching a new handle.
 *
 * Provided by TrackedAccountContext:
 *   handle, setHandle, accounts, addAccount, removeAccount, loading
 */

'use strict'

import React, { useState, useRef, useEffect } from 'react'
import {
  ChevronDown, ChevronsUpDown, Plus, Check, Loader2, AtSign, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'

export default function AccountSwitcher() {
  const {
    handle, setHandle, accounts, addAccount, removeAccount, loading,
  } = useTrackedAccount()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null) // username pending confirm
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setConfirmRemove(null)
        setAdding(false)
      }
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

  const handleRemove = async (username) => {
    if (confirmRemove === username) {
      await removeAccount(username)
      setConfirmRemove(null)
    } else {
      setConfirmRemove(username)
    }
  }

  if (loading) {
    return (
      <div className="flex w-full items-center gap-3 p-2 rounded-lg">
        <div className="size-9 rounded-md bg-foreground/[0.05] animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-24 bg-foreground/[0.05] rounded animate-pulse" />
          <div className="h-2 w-14 bg-foreground/[0.05] rounded animate-pulse" />
        </div>
      </div>
    )
  }

  const initial = (handle || '?')[0].toUpperCase()
  const empty = accounts.length === 0

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
          open ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.03]',
        )}
      >
        <div className="size-9 rounded-md bg-gradient-to-br from-brand-ink to-foreground grid place-items-center text-white font-display font-bold text-sm flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-tight truncate">
            {handle ? `@${handle}` : 'No account watched'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
            {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} watched
          </div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground flex-shrink-0" strokeWidth={2} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl bg-card p-1.5 shadow-pop ring-1 ring-foreground/[0.08]">
          {/* Account list */}
          <div className="max-h-64 overflow-y-auto py-0.5">
            {empty && !adding && (
              <div className="px-3 py-4 text-center">
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  No watched accounts yet.<br />Add one below to start tracking.
                </div>
              </div>
            )}
            {accounts.map((acc) => {
              const active = acc.username === handle
              const pending = confirmRemove === acc.username
              return (
                <div
                  key={acc.id || acc.username}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg pl-1.5 pr-1 py-1.5 transition-colors',
                    active ? 'bg-brand-soft' : 'hover:bg-foreground/[0.03]',
                  )}
                >
                  <button
                    onClick={() => { setHandle(acc.username); setOpen(false); setConfirmRemove(null) }}
                    className="flex flex-1 items-center gap-2.5 text-left min-w-0"
                  >
                    <span className={cn(
                      'size-7 shrink-0 rounded-md grid place-items-center text-[11px] font-display font-bold',
                      active
                        ? 'bg-brand text-foreground'
                        : 'bg-foreground/[0.05] text-foreground/70',
                    )}>
                      {acc.username[0].toUpperCase()}
                    </span>
                    <span className={cn(
                      'flex-1 truncate text-sm tracking-tight',
                      active ? 'font-semibold text-brand-ink' : 'text-foreground/80',
                    )}>
                      @{acc.username}
                    </span>
                    {active && <Check className="size-3.5 text-brand-ink shrink-0" strokeWidth={2.5} />}
                  </button>

                  {/* Remove control */}
                  {pending ? (
                    <button
                      onClick={() => handleRemove(acc.username)}
                      className="px-2 py-1 rounded-md bg-negative text-white text-[10px] font-bold uppercase tracking-wider hover:bg-negative/90 transition-colors"
                      title="Confirm remove"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRemove(acc.username)}
                      className={cn(
                        'size-7 shrink-0 rounded-md grid place-items-center transition-colors',
                        'opacity-0 group-hover:opacity-100',
                        'text-muted-foreground hover:text-negative hover:bg-negative/10',
                      )}
                      title={`Stop watching @${acc.username}`}
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Divider */}
          {!empty && <div className="my-1 border-t border-hairline" />}

          {/* Add account */}
          {adding ? (
            <div className="flex items-center gap-1.5 p-1">
              <div className="relative flex-1">
                <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  autoFocus
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') { setAdding(false); setNewUsername('') }
                  }}
                  placeholder="username"
                  className="w-full rounded-md bg-surface-2/60 ring-1 ring-foreground/[0.06] py-1.5 pl-7 pr-2 text-[12px] focus:outline-none focus:ring-brand transition-all"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={submitting || !newUsername.trim()}
                className="rounded-md bg-foreground text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-brand hover:text-foreground transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {submitting ? <Loader2 className="size-3 animate-spin" /> : 'Add'}
              </button>
              <button
                onClick={() => { setAdding(false); setNewUsername('') }}
                className="rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-foreground/[0.04] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-brand-ink hover:bg-brand-soft transition-colors"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Watch new account
            </button>
          )}
        </div>
      )}
    </div>
  )
}
