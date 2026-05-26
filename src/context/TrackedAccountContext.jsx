/**
 * TrackedAccountContext — shared state for the active tracked handle.
 *
 * Replaces the pattern where every pane independently queries Supabase
 * tracked_accounts. Now all panes read from useTrackedAccount() and
 * automatically re-fetch when the user switches handles.
 *
 * Provides: { handle, setHandle, accounts, addAccount, loading }
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
  loading: true,
})

export function TrackedAccountProvider({ children }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [handle, setHandleRaw] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load all tracked accounts for this user
  useEffect(() => {
    if (!user) {
      setAccounts([])
      setHandleRaw(null)
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
        if (!cancelled && !error && data) {
          setAccounts(data)
          // Default to most recent if no handle selected
          if (!handle && data.length > 0) {
            setHandleRaw(data[0].username)
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
    // Clear all per-handle localStorage caches so panes fetch fresh data
    // for the new handle instead of showing stale cached data from the old one
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

  return (
    <TrackedAccountContext.Provider value={{ handle, setHandle, accounts, addAccount, loading }}>
      {children}
    </TrackedAccountContext.Provider>
  )
}

export function useTrackedAccount() {
  return useContext(TrackedAccountContext)
}
