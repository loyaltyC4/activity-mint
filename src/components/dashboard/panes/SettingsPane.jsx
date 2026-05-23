/**
 * Settings — notifications, theme, tracked accounts, sign out.
 *
 * Email notifications write to the digest_preferences table (Wave 3
 * migration). Tracked accounts read/delete via tracked_accounts.
 */

'use strict'

import React, { useEffect, useState } from 'react'
import { Mail, Bell, Moon, LogOut, Trash2, AtSign } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTier } from '../../../context/TierContext'
import { supabase } from '../../../lib/supabase'
import { getDigestPreferences, upsertDigestPreferences } from '../../../lib/digest'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

function Row({ Icon, label, sub, action }) {
  return (
    <div className="flex items-center justify-between border-b border-[#e0eae7] py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[#64756f]" />
        <div>
          <div className="text-[13px] font-semibold">{label}</div>
          {sub && <div className="text-[11px] text-[#64756f]">{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  )
}

export default function SettingsPane() {
  const { user } = useAuth()
  const { tier } = useTier()
  const [digest, setDigest]     = useState({ email_enabled: false, frequency: 'weekly' })
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [theme, setTheme]       = useState(() => document?.documentElement?.classList?.contains('dark') ? 'dark' : 'light')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      getDigestPreferences(user.id).catch(() => null),
      supabase.from('tracked_accounts').select('id, username, created_at').eq('user_id', user.id),
    ]).then(([d, a]) => {
      if (cancelled) return
      if (d) setDigest({ ...digest, ...d })
      setAccounts(a?.data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function toggleEmail(checked) {
    const next = { ...digest, email_enabled: checked }
    setDigest(next)
    if (user) await upsertDigestPreferences(user.id, next).catch((err) => console.error(err))
  }

  async function changeFrequency(freq) {
    const next = { ...digest, frequency: freq }
    setDigest(next)
    if (user) await upsertDigestPreferences(user.id, next).catch(() => {})
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  async function removeAccount(id) {
    await supabase.from('tracked_accounts').delete().eq('id', id)
    setAccounts((l) => l.filter((a) => a.id !== id))
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.assign('/')
  }

  return (
    <>
      <PaneHeader title="Settings" subtitle="Account, notifications and theme" />

      <div className="space-y-4">
        {/* Profile */}
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="text-base font-bold">Profile</div>
          <Row Icon={AtSign} label="Email" sub={user?.email || '—'}                action={null} />
          <Row Icon={Trash2} label="Subscription tier" sub={`Currently ${tier || 'free'}`} action={null} />
        </div>

        {/* Notifications */}
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="text-base font-bold">Email digest</div>
          <Row
            Icon={Mail}
            label="Send me digest emails"
            sub="Weekly or daily summary of your insights"
            action={<Switch checked={digest.email_enabled} onCheckedChange={toggleEmail} />}
          />
          {digest.email_enabled && (
            <Row
              Icon={Bell}
              label="Frequency"
              sub="Choose how often you receive digests"
              action={
                <select
                  value={digest.frequency}
                  onChange={(e) => changeFrequency(e.target.value)}
                  className="rounded-md border border-[#e0eae7] bg-white px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              }
            />
          )}
        </div>

        {/* Tracked accounts */}
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-2 text-base font-bold">Tracked accounts</div>
          <div className="text-xs text-[#64756f] mb-3">Add or remove the Instagram handles you analyse</div>
          {loading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : accounts.length === 0 ? (
            <p className="text-sm text-[#64756f]">No accounts tracked yet.</p>
          ) : (
            <div>
              {accounts.map((a) => (
                <Row
                  key={a.id}
                  Icon={AtSign}
                  label={`@${a.username}`}
                  sub={`Added ${new Date(a.created_at).toLocaleDateString()}`}
                  action={
                    <button onClick={() => removeAccount(a.id)} className="rounded-lg p-2 text-[#64756f] hover:bg-rose-50 hover:text-rose-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Appearance */}
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="text-base font-bold">Appearance</div>
          <Row
            Icon={Moon}
            label="Dark mode"
            sub="Switch between light and dark theme"
            action={<Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />}
          />
        </div>

        {/* Session */}
        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <button onClick={signOut} className="flex w-full items-center gap-2 text-left text-rose-500 transition-colors hover:text-rose-600">
            <LogOut className="h-4 w-4" />
            <span className="text-[13px] font-semibold">Sign out</span>
          </button>
        </div>
      </div>
    </>
  )
}
