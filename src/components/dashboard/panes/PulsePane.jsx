/**
 * Pulse — the user's daily snapshot.
 *
 * Loading strategy (fast UX):
 *   1. On mount: check localStorage cache → render INSTANTLY if cached (<5 min old)
 *   2. In parallel + in background: fetch profile (fast cluster ~5s) then
 *      stories + posts (~12s). Each section updates the moment its data lands.
 *   3. Persist fresh data back to localStorage for next visit.
 *
 * The page paints in <100ms when cache exists. Even without cache, skeletons
 * appear immediately and individual cards swap in as their data arrives.
 */

'use strict'

import React, { useEffect, useState, useCallback } from 'react'
import { Flame, TrendingUp, Activity, Heart, MessageCircle, Clock, Bell, Sparkles, Radio, Smile } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTier } from '../../../context/TierContext'
import { supabase } from '../../../lib/supabase'
import {
  fetchInstagramProfile,
  fetchInstagramProfileWithPosts,
  fetchInstagramStories,
} from '../../../lib/apify'
import KpiCard from '../shared/KpiCard'
import InsightCard from '../shared/InsightCard'
import StoryRing from '../shared/StoryRing'
import PostThumb from '../shared/PostThumb'
import EmptyState from '../EmptyState'
import { proxyImg, fmt as fmtShared } from '../shared/utils'

// ── Cache helpers ─────────────────────────────────────────────────────────
const CACHE_KEY = (h) => `pulse:v1:${h}`
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function loadCache(handle) {
  if (!handle || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY(handle))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || (Date.now() - (data.t || 0)) > CACHE_TTL_MS) return null
    return data
  } catch { return null }
}
function saveCache(handle, payload) {
  if (!handle || typeof localStorage === 'undefined') return
  try { localStorage.setItem(CACHE_KEY(handle), JSON.stringify({ ...payload, t: Date.now() })) } catch {}
}

function PaneHeader({ title, subtitle, stale }) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
      </div>
      {stale && (
        <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]">
          Refreshing…
        </span>
      )}
    </div>
  )
}

function ActivityCard({ stories, posts, loading }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Recent Activity</div>
          <div className="text-base font-bold">Your posts &amp; stories</div>
        </div>
        <button className="text-xs font-semibold text-teal-600 hover:underline">View all →</button>
      </div>

      <div className="mb-5">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#64756f]">Active Stories</div>
        <div className="flex flex-wrap items-start gap-3.5">
          {loading && stories.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[54px] w-[54px] rounded-full" />)
            : stories.length > 0
              ? stories.map((s, i) => (
                  <StoryRing key={i} thumb={s.thumb || '📸'} label={s.label} seen={s.seen} />
                ))
              : <div className="text-xs text-[#64756f]">No active stories.</div>}
          <StoryRing addNew label="Add story" />
        </div>
      </div>

      <div>
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#64756f]">Recent Posts</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {loading && posts.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-[14px]" />)
            : posts.length > 0
              ? posts.slice(0, 4).map((p, i) => (
                  <PostThumb
                    key={p.id || i}
                    imageUrl={proxyImg(p.displayUrl || p.thumbnailUrl || p.imageUrl)}
                    likes={p.likesCount ?? p.likes}
                    comments={p.commentsCount ?? p.comments}
                    gradientIndex={i}
                  />
                ))
              : <div className="col-span-full text-xs text-[#64756f]">No recent posts yet.</div>}
        </div>
      </div>
    </div>
  )
}

function InsightsCard({ insights, isPaid, onUpgrade }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Today</div>
          <div className="text-base font-bold">Plain-English insights</div>
        </div>
        <span className="text-[11px] text-[#64756f]">by impact</span>
      </div>
      <p className="mb-4 text-xs text-[#64756f]">
        {isPaid ? 'All insights unlocked.' : 'Free shows 1 — the rest unlock with Pro.'}
      </p>
      <div className="flex flex-col gap-2.5">
        {insights.map((ins, i) => (
          <InsightCard
            key={i}
            Icon={ins.Icon}
            body={ins.body}
            cta={ins.cta}
            tone={ins.tone}
            locked={!isPaid && i > 0}
            onUnlock={onUpgrade}
          />
        ))}
      </div>
    </div>
  )
}

function QuestsCard({ streak = 0 }) {
  const quests = [
    { id: 1, done: true,  label: "Check today's insight", xp: 10 },
    { id: 2, done: false, label: 'Post 1 Reel',           xp: 30 },
    { id: 3, done: false, label: 'Reply to 3 comments',   xp: 15 },
  ]
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Daily quests</div>
      <div className="text-base font-bold">
        Small wins → keep your <Flame className="inline h-3.5 w-3.5 text-amber-500" />
      </div>
      <p className="mb-4 text-xs text-[#64756f]">
        {streak > 0 ? `Complete all 3 to protect your ${streak}-day streak.` : 'Complete all 3 to start a streak.'}
      </p>
      <div className="flex flex-col gap-2">
        {quests.map((q) => (
          <div
            key={q.id}
            className={`flex items-center gap-3 rounded-xl p-2.5 ${
              q.done ? 'bg-teal-50 shadow-[0_0_0_1px_rgba(20,184,166,0.2)]' : 'bg-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.3)]'
            }`}
          >
            <div className={`grid h-6 w-6 place-items-center rounded-[8px] text-xs font-bold ${
              q.done ? 'bg-teal-500 text-white' : 'bg-white text-amber-500 shadow-[0_0_0_2px_currentColor]'
            }`}>
              {q.done ? '✓' : '○'}
            </div>
            <span className={`flex-1 text-[13px] font-medium ${q.done ? 'text-[#64756f] line-through' : ''}`}>{q.label}</span>
            <span className="text-[11px] font-bold text-amber-500">+{q.xp} XP</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-[#e0eae7] pt-3.5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#64756f]">Next best window</div>
        <div className="flex items-center gap-2.5 rounded-xl bg-teal-50 p-2.5 shadow-[0_0_0_1px_rgba(20,184,166,0.2)]">
          <Clock className="h-4 w-4 text-teal-600" />
          <div className="flex-1">
            <div className="text-[13px] font-bold">Thu, 7:00 PM</div>
            <div className="text-[11px] text-[#64756f]">Est. +640 reach vs. now</div>
          </div>
          <button className="rounded-[8px] bg-teal-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-600">
            <Bell className="-mt-px mr-1 inline h-3 w-3" /> Set reminder
          </button>
        </div>
      </div>
    </div>
  )
}

// local fmt() removed — use shared fmtShared from ../shared/utils
const fmt = fmtShared

export default function PulsePane({ timeRange }) {
  const { user } = useAuth()
  const { tier } = useTier()
  const isPaid = tier === 'standard' || tier === 'premium'

  const [handle, setHandle]     = useState(null)
  const [handleLoading, setHL]  = useState(true)
  const [profile, setProfile]   = useState(null)
  const [stories, setStories]   = useState([])
  const [posts, setPosts]       = useState([])
  const [refreshing, setRefresh] = useState(false)

  // 1) Resolve the user's tracked handle from Supabase (fast — DB query <200ms)
  useEffect(() => {
    if (!user) { setHL(false); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('tracked_accounts')
        .select('username')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      setHL(false)
      if (error || !data) { setHandle(null); return }
      setHandle(data.username)
    })()
    return () => { cancelled = true }
  }, [user])

  // 2) Once we have a handle: hydrate from cache instantly, then refresh in background
  const hydrate = useCallback(async (h) => {
    // a. Instant paint from cache
    const cached = loadCache(h)
    if (cached) {
      if (cached.profile) setProfile(cached.profile)
      if (cached.stories) setStories(cached.stories)
      if (cached.posts)   setPosts(cached.posts)
    }
    setRefresh(true)

    // b. Staged refresh — profile first (fast cluster call), then stories + posts in parallel
    let profileNext = cached?.profile || null
    try {
      const items = await fetchInstagramProfile(h)
      if (items && items[0]) {
        profileNext = items[0]
        setProfile(profileNext)
      }
    } catch (err) {
      console.warn('pulse: profile fetch failed', err)
    }

    // c. Now fetch stories + full profile (with posts) in parallel
    const [storiesRes, postsRes] = await Promise.allSettled([
      fetchInstagramStories(h),
      fetchInstagramProfileWithPosts(h),
    ])

    let storiesNext = cached?.stories || []
    if (storiesRes.status === 'fulfilled') {
      const raw = storiesRes.value || []
      storiesNext = raw.map((s, i) => ({ thumb: ['🎬','✨','📸','🎨'][i % 4], label: `Story ${i + 1}` }))
      setStories(storiesNext)
    }

    let postsNext = cached?.posts || []
    if (postsRes.status === 'fulfilled') {
      const apifyProfile = postsRes.value?.[0]
      if (apifyProfile?.latestPosts) {
        postsNext = apifyProfile.latestPosts
        setPosts(postsNext)
      }
      // Also merge any richer profile fields from Apify (followers, engagement)
      if (apifyProfile) {
        profileNext = { ...profileNext, ...apifyProfile }
        setProfile(profileNext)
      }
    }

    saveCache(h, { profile: profileNext, stories: storiesNext, posts: postsNext })
    setRefresh(false)
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  // Empty state: no handle tracked yet
  if (!handleLoading && !handle) {
    return <EmptyState user={user} onHandleAdded={(h) => { setHandle(h) }} />
  }

  const followers  = profile?.followersCount ?? profile?.followers ?? null
  const engagement = profile?.engagementRate ?? null
  const hasData    = !!profile || posts.length > 0

  const insights = [
    { Icon: Activity, body: 'Your Reels earn 3.2× more saves than photos this month.', cta: 'Post 2 more Reels this week', tone: 'teal' },
    { Icon: Clock,    body: 'Your audience peaks Thu 7–9pm but your last 3 posts went live at 1pm.', cta: 'Schedule Thu 7pm · ~+640 reach', tone: 'violet' },
    { Icon: MessageCircle, body: 'Mentions of "tutorial" spiked +40% — your audience wants to be taught.', cta: 'See sentiment & post ideas', tone: 'coral' },
  ]

  return (
    <>
      <PaneHeader title="Pulse" subtitle={`Your daily snapshot — ${timeRange} view`} stale={refreshing} />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <KpiCard label="Mint Score"    value={hasData ? 75 : '--'}            Icon={Sparkles} trend={8}   trendLabel="↑ +8 this week"      sparkData={[22,20,20,18,16,13,11,8]} sparkColor="teal" />
          <KpiCard label="Reach"         value={fmt(followers)}                 Icon={Radio}    trend={22}  trendLabel="↑ +22%"              sparkData={[26,22,24,19,20,13,9,3]}  sparkColor="sky" />
          <KpiCard label="Engagement"    value={engagement ? `${engagement.toFixed(1)}%` : (hasData ? '6.4%' : '--')} Icon={Heart} trend={1.1} trendLabel="↑ +1.1pt" sparkData={[24,22,19,18,14,12,8,4]} sparkColor="coral" />
          <KpiCard label="Audience mood" value={hasData ? '78%' : '--'}         Icon={Smile}                trendLabel="↑ trending positive"  sparkData={[24,20,22,17,13,11,8,4]} sparkColor="violet" />
        </div>

        <ActivityCard stories={stories} posts={posts} loading={refreshing} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <InsightsCard insights={insights} isPaid={isPaid} onUpgrade={() => alert('Upgrade flow coming')} />
          <QuestsCard streak={0} />
        </div>
      </div>
    </>
  )
}
