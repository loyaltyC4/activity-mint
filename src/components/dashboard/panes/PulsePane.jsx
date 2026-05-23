/**
 * Pulse — the user's daily snapshot.
 *
 * Sections (top to bottom):
 * 1. KPI row (Mint Score / Reach / Engagement / Audience Mood)
 * 2. Recent activity card (active stories + recent posts grid)
 * 3. Plain-English insights (1 free, others tier-locked)
 *    + Daily quests with next-best-window CTA
 * 4. Best post recipe with copy-template button
 *
 * Empty state: when no tracked handle exists, renders EmptyState so the
 * admin can populate the dashboard from a real scrape.
 */

'use strict'

import React, { useEffect, useState } from 'react'
import { Flame, TrendingUp, Activity, Smile, Heart, MessageCircle, Clock, Bell } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTier } from '../../../context/TierContext'
import { supabase } from '../../../lib/supabase'
import { fetchInstagramProfileWithPosts, fetchInstagramStories } from '../../../lib/apify'
import KpiCard from '../shared/KpiCard'
import InsightCard from '../shared/InsightCard'
import StoryRing from '../shared/StoryRing'
import PostThumb from '../shared/PostThumb'
import EmptyState from '../EmptyState'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
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
          {loading
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
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-[14px]" />)
            : posts.length > 0
              ? posts.slice(0, 4).map((p, i) => (
                  <PostThumb
                    key={p.id || i}
                    imageUrl={p.displayUrl || p.thumbnailUrl}
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

export default function PulsePane({ timeRange }) {
  const { user } = useAuth()
  const { tier } = useTier()
  const isPaid = tier === 'standard' || tier === 'premium'

  const [handle, setHandle]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [stories, setStories] = useState([])

  // 1) Resolve the user's tracked handle from Supabase
  useEffect(() => {
    if (!user) { setLoading(false); return }
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
      if (error || !data) { setLoading(false); setHandle(null); return }
      setHandle(data.username)
    })()
    return () => { cancelled = true }
  }, [user])

  // 2) Fetch profile + posts + stories once we have a handle
  useEffect(() => {
    if (!handle) return
    let cancelled = false
    setLoading(true)
    Promise.allSettled([
      fetchInstagramProfileWithPosts(handle),
      fetchInstagramStories(handle),
    ]).then(([profileRes, storiesRes]) => {
      if (cancelled) return
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value?.[0] || null)
      }
      if (storiesRes.status === 'fulfilled') {
        const raw = storiesRes.value || []
        setStories(raw.map((s, i) => ({ thumb: ['🎬','✨','📸','🎨'][i % 4], label: `Story ${i + 1}` })))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [handle])

  // Empty state: no handle tracked yet
  if (!loading && !handle) {
    return <EmptyState user={user} onHandleAdded={(h) => { setHandle(h); setLoading(true) }} />
  }

  const followers = profile?.followersCount ?? null
  const engagement = profile?.engagementRate ?? null
  const posts = profile?.latestPosts || []

  const insights = [
    { Icon: Activity, body: 'Your Reels earn 3.2× more saves than photos this month.', cta: 'Post 2 more Reels this week', tone: 'teal' },
    { Icon: Clock,    body: 'Your audience peaks Thu 7–9pm but your last 3 posts went live at 1pm.', cta: 'Schedule Thu 7pm · ~+640 reach', tone: 'violet' },
    { Icon: MessageCircle, body: 'Mentions of "tutorial" spiked +40% — your audience wants to be taught.', cta: 'See sentiment & post ideas', tone: 'coral' },
  ]

  return (
    <>
      <PaneHeader title="Pulse" subtitle={`Your daily snapshot — ${timeRange} view`} />

      <div className="space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <KpiCard label="Mint Score"     value={loading ? '--' : 75}                emoji="💎" trend={8}  trendLabel="↑ +8 this week"   sparkData={[22,20,20,18,16,13,11,8]}  sparkColor="teal" />
          <KpiCard label="Reach"          value={loading ? '--' : fmt(followers)}    emoji="📡" trend={22} trendLabel="↑ +22%"           sparkData={[26,22,24,19,20,13,9,3]}   sparkColor="sky" />
          <KpiCard label="Engagement"     value={loading ? '--' : `${(engagement || 6.4).toFixed(1)}%`} emoji="❤️" trend={1.1} trendLabel="↑ +1.1pt" sparkData={[24,22,19,18,14,12,8,4]} sparkColor="coral" />
          <KpiCard label="Audience mood"  value={loading ? '--' : '78%'}             emoji="🙂" trendLabel="↑ trending positive"  sparkData={[24,20,22,17,13,11,8,4]} sparkColor="violet" />
        </div>

        <ActivityCard stories={stories} posts={posts} loading={loading} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <InsightsCard insights={insights} isPaid={isPaid} onUpgrade={() => alert('Upgrade flow coming')} />
          <QuestsCard streak={0} />
        </div>
      </div>
    </>
  )
}

function fmt(n) {
  if (n === null || n === undefined) return '--'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}
