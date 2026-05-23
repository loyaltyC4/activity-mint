/**
 * Empty state shown when the logged-in user hasn't added a tracked
 * Instagram handle yet. Big call-to-action wired to the existing
 * tracked_accounts table — adding triggers profile + stories + followers
 * scrapes through the working cluster (workers 2/3/5).
 */

'use strict'

import React, { useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '../../lib/supabase'

export default function EmptyState({ user, onHandleAdded }) {
  const [handle, setHandle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e?.preventDefault?.()
    const clean = handle.trim().replace(/^@/, '')
    if (!clean) {
      setError('Enter an Instagram username')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { error: insertErr } = await supabase
        .from('tracked_accounts')
        .insert([{ user_id: user.id, username: clean }])
      if (insertErr && !/duplicate/i.test(insertErr.message)) {
        setError(insertErr.message)
      } else {
        onHandleAdded?.(clean)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-teal-50 text-3xl shadow-[0_0_0_1px_rgba(20,184,166,0.2)]">
          <Sparkles className="h-8 w-8 text-teal-600" />
        </div>
        <h2 className="mb-1.5 text-xl font-bold tracking-tight">Add your Instagram handle</h2>
        <p className="mb-6 text-sm text-[#64756f]">
          We'll pull your last posts and stories so you can see what's working — usually takes about 15 seconds.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64756f]" />
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="username (without @)"
              className="pl-9"
              disabled={submitting}
              autoFocus
            />
          </div>
          <Button type="submit" disabled={submitting} className="bg-teal-500 hover:bg-teal-600">
            {submitting ? 'Adding...' : 'Continue'}
          </Button>
        </form>
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>
        )}
        <div className="mt-6 text-xs text-[#64756f]">
          You can change or add more accounts later in Settings.
        </div>
      </div>
    </div>
  )
}
