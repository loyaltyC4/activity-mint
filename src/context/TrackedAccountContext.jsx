/**
 * TrackedAccountContext — shared state for the active tracked handle.
 *
 * Replaces the pattern where every pane independently queries Supabase
 * tracked_accounts. Now all panes read from useTrackedAccount() and
 * automatically re-fetch when the user switches handles.
 *
 * Provides: { handle, setHandle, accounts, addAccount, removeAccount, loading }
 */

'use strict'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const TrackedAccountContext = createContext({
  handle: null,
  setHandle: () => {},
  accounts: [],
  addAccount: async () => {},
  removeAccount: async () => {},
  loading: true,
})

// Persist the last-active handle so refresh keeps the user on the same account
const LAST_HANDLE_KEY = 'am.tracked.last_handle.v1'

function readLastHandle() {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(LAST_HANDLE_KEY) || null } catch { return null }
}
function writeLastHandle(h) {
  if (typeof window === 'undefined') return
  try {
    if (h) window.localStorage.setItem(LAST_HANDLE_KEY, h)
    else window.localStorage.removeItem(LAST_HANDLE_KEY)
  } catch {}
}

export function TrackedAccountProvider({ children }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [handle, setHandleRaw] = useState(readLastHandle)
  const [loading, setLoading] = useState(true)

  // Load all tracked accounts for this user
  useEffect(() => {
    if (!user) {
      setAccounts([])
      setHandleRaw(null)
      writeLastHandle(null)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tracked_accounts')
          .select('id, username, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (cancelled) return
        if (!error && data) {
          setAccounts(data)
          const lastHandle = readLastHandle()
          // Prefer the last-active handle if it's still in the user's list
          const lastInList = lastHandle && data.find((a) => a.username === lastHandle)
          if (lastInList) {
            setHandleRaw(lastHandle)
          } else if (data.length > 0) {
            setHandleRaw(data[0].username)
            writeLastHandle(data[0].username)
          } else {
            setHandleRaw(null)
            writeLastHandle(null)
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  const setHandle = useCallback((username) => {
    const clean = (username || '').trim().replace(/^@/, '')
    if (!clean) return
    setHandleRaw(clean)
    writeLastHandle(clean)
    // Clear all per-handle localStorage caches so panes fetch fresh data
    // for the new handle instead of showing stale cached data from the old one.
    // IMPORTANT: do NOT clear keys starting with 'am.auth.' or 'sb-' (Supabase
    // auth session) — that would sign the user out.
    if (typeof window !== 'undefined') {
      const keysToRemove = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.startsWith('am:proxy:') || key.startsWith('pulse:') ||
            key.startsWith('audience:') || key.startsWith('contentlab:') ||
            key.startsWith('content_lab:') || key.startsWith('script_studio:') ||
            key.startsWith('am:digest:') || key.startsWith('am:ai:'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k))
    }
  }, [])

  const addAccount = useCallback(async (username) => {
    const clean = (username || '').trim().replace(/^@/, '')
    if (!clean) return false
    // Always switch to the handle immediately — even if Supabase insert fails,
    // the dashboard should show data for this handle
    setHandle(clean)
    // Check if already tracked in our local list
    if (accounts.some((a) => a.username === clean)) return true
    // Try to persist to Supabase (may fail due to RLS or missing table — that's OK)
    if (user) {
      try {
        const { data, error } = await supabase
          .from('tracked_accounts')
          .insert({ user_id: user.id, username: clean })
          .select()
          .single()
        if (!error && data) {
          setAccounts((prev) => [data, ...prev])
          return true
        }
        // If insert failed but account exists (duplicate), still add to local list
        if (error?.code === '23505') {
          setAccounts((prev) => [{ username: clean, id: clean, created_at: new Date().toISOString() }, ...prev])
          return true
        }
      } catch {}
    }
    // Even if Supabase failed, add to local state so the dropdown shows it
    setAccounts((prev) => {
      if (prev.some((a) => a.username === clean)) return prev
      return [{ username: clean, id: clean, created_at: new Date().toISOString() }, ...prev]
    })
    return true
  }, [user, accounts, setHandle])

  /**
   * removeAccount — stop watching a handle. Removes the row from Supabase
   * (best-effort) and from the local list. If the removed handle was the
   * active one, falls back to the most recent remaining account.
   */
  const removeAccount = useCallback(async (username) => {
    const clean = (username || '').trim().replace(/^@/, '')
    if (!clean) return false

    // Optimistic local removal
    const remaining = accounts.filter((a) => a.username !== clean)
    setAccounts(remaining)

    // If the active handle was the removed one, switch to next available
    if (handle === clean) {
      const nextHandle = remaining[0]?.username || null
      setHandleRaw(nextHandle)
      writeLastHandle(nextHandle)
    }

    // Best-effort delete from Supabase
    if (user) {
      try {
        await supabase
          .from('tracked_accounts')
          .delete()
          .eq('user_id', user.id)
          .eq('username', clean)
      } catch {}
    }
    return true
  }, [user, accounts, handle])

  return (
    <TrackedAccountContext.Provider value={{ handle, setHandle, accounts, addAccount, removeAccount, loading }}>
      {children}
    </TrackedAccountContext.Provider>
  )
}

export function useTrackedAccount() {
  return useContext(TrackedAccountContext)
}
