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
    setHandleRaw(username)
  }, [])

  const addAccount = useCallback(async (username) => {
    if (!user || !username) return false
    const clean = username.trim().replace(/^@/, '')
    if (!clean) return false
    // Check if already tracked
    if (accounts.some((a) => a.username === clean)) {
      setHandleRaw(clean)
      return true
    }
    try {
      const { data, error } = await supabase
        .from('tracked_accounts')
        .insert({ user_id: user.id, username: clean })
        .select()
        .single()
      if (!error && data) {
        setAccounts((prev) => [data, ...prev])
        setHandleRaw(clean)
        return true
      }
    } catch {}
    return false
  }, [user, accounts])

  return (
    <TrackedAccountContext.Provider value={{ handle, setHandle, accounts, addAccount, loading }}>
      {children}
    </TrackedAccountContext.Provider>
  )
}

export function useTrackedAccount() {
  return useContext(TrackedAccountContext)
}
