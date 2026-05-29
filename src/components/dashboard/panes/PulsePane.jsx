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

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Flame, TrendingUp, Activity, Heart, MessageCircle, Clock, Bell, Sparkles, Radio, Smile, Brain, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import { useTier } from '../../../context/TierContext'
import { supabase } from '../../../lib/supabase'
import {
  // Speed-v5: dashboard-context fetchers (Apify path, faster cold, instant warm via edge cache)
  fetchDashboardProfile,
  fetchDashboardTopCommenters,
  // Cluster-side: stories stays on cluster (faster + free), enrichment too
  fetchInstagramStoriesSWR,
  fetchAudienceEnrichmentSWR,
  fetchAIInsights,
  // Legacy fallbacks kept in case any caller needs them
  fetchInstagramProfile,
  fetchInstagramProfileSWR,
  fetchInstagramProfileWithPosts,
  fetchInstagramStories,
  fetchInstagramPosts,
  fetchInstagramPostsSWR,
  fetchTopCommenters,
  fetchTopCommentersSWR,
  fetchAudienceEnrichment,
} from '../../../lib/apify'
import KpiCard from '../shared/KpiCard'
import SectionCard from '../shared/SectionCard'
import RingMeter from '../shared/RingMeter'
import InsightCard from '../shared/InsightCard'
import StoryRing from '../shared/StoryRing'
import PostThumb from '../shared/PostThumb'
import EmptyState from '../EmptyState'
import { proxyImg, fmt as fmtShared } from '../shared/utils'
import { extractBrand } from '../../../lib/brandExtract'

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

function BrandOverviewCard({ profile, posts }) {
  const brand = useMemo(() => extractBrand(profile, posts), [profile, posts])
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  if (!brand || (!brand.voice?.id && brand.pillars?.length === 0)) return null

  const handleAI = async () => {
    setAiLoading(true)
    try {
      const r = await fetchAIInsights({
        request_type: 'brand_overview',
        profile: profile ? { username: profile.username, followersCount: profile.followersCount || profile.followers, biography: profile.biography } : null,
        topic: `voice=${brand.voice?.label}, pillars=${brand.pillars?.map(p=>p.label).join(',')}`,
      })
      if (r?.insights) setAiSummary(r.insights.join(' '))
      else if (r?.voice_summary) setAiSummary(r.voice_summary)
      else if (r?.raw) setAiSummary(r.raw)
    } catch {} finally { setAiLoading(false) }
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Brand DNA</div>
            <div className="text-base font-bold">Your content identity</div>
          </div>
        </div>
        {!aiSummary && (
          <button onClick={handleAI} disabled={aiLoading}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:scale-[1.02] transition-all disabled:opacity-60">
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {aiLoading ? 'Analysing...' : 'AI Summary'}
          </button>
        )}
      </div>

      {/* Deterministic brand signals — instant, zero tokens */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {/* Voice */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Voice</div>
          <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${brand.voice?.color || 'bg-slate-100 text-slate-600'}`}>
            {brand.voice?.label || 'Neutral'}
          </span>
        </div>
        {/* Visual style */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Visual style</div>
          <div className="text-[12px] font-bold text-slate-800 capitalize">{brand.visualStyle?.dominant || '—'}-led</div>
          {brand.visualStyle?.mix && (
            <div className="text-[10px] text-slate-500 mt-0.5">
              {Object.entries(brand.visualStyle.mix).map(([k,v]) => `${k} ${v}%`).join(' / ')}
            </div>
          )}
        </div>
        {/* Audience depth */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Audience</div>
          <div className="text-[12px] font-bold text-slate-800">{brand.audienceDepth?.label || '—'}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{brand.audienceDepth?.ratio?.toFixed(1) || 0}% comment ratio</div>
        </div>
        {/* Cadence */}
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Posting</div>
          <div className="text-[12px] font-bold text-slate-800">{brand.cadence?.label || '—'}</div>
          {brand.cadence?.avgDaysBetween && (
            <div className="text-[10px] text-slate-500 mt-0.5">~{brand.cadence.avgDaysBetween}d avg gap</div>
          )}
        </div>
      </div>

      {/* Content pillars */}
      {brand.pillars?.length > 0 && (
        <div className="mb-3">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Content pillars</div>
          <div className="flex flex-wrap gap-1.5">
            {brand.pillars.map((p) => (
              <span key={p.id} className="rounded-md bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                {p.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visual style recommendation */}
      {brand.visualStyle?.recommendation && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{brand.visualStyle.recommendation}</p>
      )}

      {/* AI summary (optional, renders after button click) */}
      {aiSummary && (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-violet-50/50 to-teal-50/50 p-3 shadow-[0_0_0_1px_rgba(124,58,237,0.1)]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-violet-600 mb-1">AI Brand Summary</div>
          <p className="text-[12px] text-slate-700 leading-relaxed">{aiSummary}</p>
        </div>
      )}
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

  const { handle, loading: handleLoading } = useTrackedAccount()
  const [profile, setProfile]   = useState(null)
  const [stories, setStories]   = useState([])
  const [posts, setPosts]       = useState([])
  const [refreshing, setRefresh] = useState(false)


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

    // b. SPEED-V5: ONE Apify call for profile + 12 posts (~6s warm-cluster, 133ms cached).
    // Stories stays cluster (1-2s) and runs in parallel. Edge cache makes
    // warm reads instant.
    let profileNext = cached?.profile || null
    const [profileRes, storiesRes] = await Promise.allSettled([
      fetchDashboardProfile(h, {
        onUpdate: (fresh) => {
          if (fresh && fresh[0]) setProfile((cur) => ({ ...cur, ...fresh[0] }))
        },
      }),
      fetchInstagramStoriesSWR(h, {
        onUpdate: (fresh) => {
          if (Array.isArray(fresh)) {
            const mapped = fresh.map((s, i) => ({ thumb: ['🎬','✨','📸','🎨'][i % 4], label: `Story ${i + 1}` }))
            setStories(mapped)
          }
        },
      }),
    ])

    // profile result includes latestPosts (Apify bundles them in one call)
    const postsRes = { status: 'fulfilled', value: null }
    if (profileRes.status === 'fulfilled' && profileRes.value?.[0]) {
      const item = profileRes.value[0]
      profileNext = item
      setProfile(item)
      // Synthesize posts result so the downstream merge code keeps working
      if (Array.isArray(item.latestPosts)) {
        postsRes.value = [{ ...item, latestPosts: item.latestPosts }]
      }
    }

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

  // ─── Prefetch adjacent-pane data in idle time ──────────────────────────
  // While Pulse renders, kick off the heavy fetches that Audience / Content
  // Lab / Outreach panes will need. Results land in the localStorage caches
  // those panes consult on mount, so by the time the user navigates the data
  // is already warm. Orchestrator-side Redis cache means the prefetch costs
  // ~zero on subsequent loads of the same handle.
  useEffect(() => {
    if (!handle || typeof window === 'undefined') return
    let cancelled = false
    const stash = (kind, payload) => {
      try { localStorage.setItem(`audience:${kind}:v1:${handle}`, JSON.stringify({ t: Date.now(), payload })) } catch {}
    }
    const stashContent = (kind, payload) => {
      try { localStorage.setItem(`contentlab:${kind}:v1:${handle}`, JSON.stringify({ t: Date.now(), payload })) } catch {}
    }
    const run = () => {
      if (cancelled) return
      // Speed-v5 prefetch: dashboard-context Apify path for top_commenters.
      // Audience enrichment + posts stay on cluster (cheaper). All three feed
      // both legacy cache keys (audience:* contentlab:*) AND the new SWR keys.
      fetchDashboardTopCommenters(handle, { postLimit: 4, commentLimit: 30, topN: 16 })
        .then((items) => !cancelled && stash('top_commenters', items || []))
        .catch(() => {})
      fetchAudienceEnrichmentSWR(handle, 25, 0)
        .then((items) => !cancelled && stash('audience_enrichment', items || []))
        .catch(() => {})
      fetchInstagramPostsSWR(handle, 24)
        .then((items) => !cancelled && stashContent('posts', items || []))
        .catch(() => {})
    }
    // Schedule via requestIdleCallback so we don't block Pulse's first paint.
    // Fall back to setTimeout(2000) on browsers without rIC.
    const handleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(run, { timeout: 4000 })
      : setTimeout(run, 2000)
    return () => {
      cancelled = true
      if ('cancelIdleCallback' in window && typeof handleId === 'number') {
        try { window.cancelIdleCallback(handleId) } catch {}
      } else {
        try { clearTimeout(handleId) } catch {}
      }
    }
  }, [handle])

  // Empty state: no handle tracked yet
  if (!handleLoading && !handle) {
    return <EmptyState user={user} onHandleAdded={(h) => { setHandle(h) }} />
  }

  const followers  = profile?.followersCount ?? profile?.followers ?? null
  const engagement = profile?.engagementRate ?? null
  const hasData    = !!profile || posts.length > 0

  // ─── Mint Score v2: 5-component composite (0–100) ──────────────────────
  // Component 1 (0–40): ER score. Tier-normalised against expected ER.
  // Component 2 (0–25): Engagement quality. Comment-to-like ratio vs 8% benchmark.
  // Component 3 (0–20): Recency. Days since last post — penalises stale accounts.
  // Component 4 (0–10): Content mix. More format variety = more resilient.
  // Component 5 (0–5):  Follower quality. Low following/followers ratio = organic.
  const mintScoreV2 = React.useMemo(() => {
    if (!profile && posts.length === 0) return null
    const following = Number(profile?.followingCount ?? profile?.following ?? 0)
    const fol = Number(followers ?? 0)
    const fol1k = fol || 1

    // Expected ER by tier
    const expectedER = fol >= 1_000_000 ? 1 : fol >= 100_000 ? 2 : fol >= 10_000 ? 4 : fol >= 1_000 ? 7 : 12

    // Compute per-post ER for the most recent post (or avg of all)
    let totalER = 0, totalCR = 0, n = 0
    for (const p of posts.slice(0, 8)) {
      const likes = Number(p.likes ?? p.likesCount ?? 0)
      const comments = Number(p.comments ?? p.commentsCount ?? 0)
      const er = fol1k > 0 ? ((likes + comments) / fol1k) * 100 : 0
      const cr = likes > 0 ? (comments / likes) : 0
      totalER += er; totalCR += cr; n += 1
    }
    const avgER = n > 0 ? totalER / n : 0
    const avgCR = n > 0 ? totalCR / n : 0

    // Component 1: ER score (0–40)
    const erScore = Math.min(40, (avgER / expectedER) * 20)

    // Component 2: Quality score (0–25) — 0.08 = 8% benchmark (1 comment per 12.5 likes)
    const qScore = Math.min(25, (avgCR / 0.08) * 25)

    // Component 3: Recency (0–20) — 2 pts lost per day, 10 days stale = 0
    let daysSince = 10
    if (posts.length > 0 && posts[0]?.timestamp) {
      const newest = posts.reduce((a, b) => {
        const at = a.timestamp ? Date.parse(a.timestamp) : 0
        const bt = b.timestamp ? Date.parse(b.timestamp) : 0
        return at > bt ? a : b
      })
      daysSince = (Date.now() - Date.parse(newest.timestamp)) / 86400000
    }
    const recencyScore = Math.max(0, 20 - daysSince * 2)

    // Component 4: Content mix (0–10)
    const types = new Set(posts.map((p) => p.type || 'Image'))
    const mixScore = types.size >= 3 ? 10 : types.size === 2 ? 7 : 4

    // Component 5: Follower quality proxy (0–5) — low following/followers = organic
    const ratio = following / Math.max(1, fol)
    const fqScore = Math.max(0, 5 * (1 - Math.min(1, ratio)))

    return Math.round(erScore + qScore + recencyScore + mixScore + fqScore)
  }, [posts, profile, followers])

  // ─── Real-data sparklines ────────────────────────────────────────────────
  // padSpark: with only 1 datapoint, synthesise [0,0,0,0,0,0,value] so the
  // chart draws a rising line from zero to the current value — visually
  // honest (the account started from nothing) and removes the dashed placeholder.
  const padSpark = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return []
    if (arr.length >= 2) return arr
    return [0, 0, 0, 0, 0, 0, arr[0]]
  }

  const sparks = React.useMemo(() => {
    if (!Array.isArray(posts) || posts.length === 0) {
      return { likes: [], engagementRate: [], mintScore: [], commentsRatio: [] }
    }
    const sorted = [...posts]
      .filter((p) => p && (p.likes ?? p.likesCount) !== undefined)
      .sort((a, b) => {
        const at = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return at - bt
      })
    const recent = sorted.slice(-8)
    const likes = recent.map((p) => Number(p.likes ?? p.likesCount ?? 0))
    const engagementRate = recent.map((p) => {
      const eng = Number(p.likes ?? p.likesCount ?? 0) + Number(p.comments ?? p.commentsCount ?? 0)
      return followers && followers > 0 ? (eng / followers) * 100 : 0
    })
    const commentsRatio = recent.map((p) => {
      const l = Number(p.likes ?? p.likesCount ?? 0)
      const c = Number(p.comments ?? p.commentsCount ?? 0)
      return l > 0 ? (c / l) * 100 : 0
    })
    // Mint v2 per-post score for sparkline — use ER/expectedER normalised
    const fol = followers || 1
    const expectedER = fol >= 1_000_000 ? 1 : fol >= 100_000 ? 2 : fol >= 10_000 ? 4 : fol >= 1_000 ? 7 : 12
    const mintScore = engagementRate.map((e) => Math.min(100, Math.round((e / expectedER) * 50)))
    return { likes, engagementRate, mintScore, commentsRatio }
  }, [posts, followers])

  // Trend = % change last → first (requires ≥2 datapoints)
  const calcTrend = (arr) => {
    if (!arr || arr.length < 2) return null
    const first = arr[0] || 0.0001
    const last = arr[arr.length - 1]
    return ((last - first) / Math.max(0.0001, Math.abs(first))) * 100
  }
  const trendMint  = calcTrend(sparks.mintScore)
  const trendER    = calcTrend(sparks.engagementRate)
  const trendReach = calcTrend(sparks.likes)
  const trendMood  = calcTrend(sparks.commentsRatio)

  // Latest values — always compute even when only 1 post
  const latestER   = sparks.engagementRate.length ? sparks.engagementRate[sparks.engagementRate.length - 1] : null
  const latestMint = sparks.mintScore.length      ? sparks.mintScore[sparks.mintScore.length - 1]           : null
  const latestMood = sparks.commentsRatio.length  ? sparks.commentsRatio[sparks.commentsRatio.length - 1]   : null

  // Single-post fallback: when sparks are empty but profile data exists
  // compute ER / mood from the most recent post + followers count
  const firstPost = posts?.[0]
  const singlePostER = (latestER == null && firstPost && followers && followers > 0)
    ? ((Number(firstPost.likes ?? firstPost.likesCount ?? 0) + Number(firstPost.comments ?? firstPost.commentsCount ?? 0)) / followers * 100)
    : null
  const singlePostMood = (latestMood == null && firstPost)
    ? (Number(firstPost.comments ?? firstPost.commentsCount ?? 0) / Math.max(1, Number(firstPost.likes ?? firstPost.likesCount ?? 1)) * 100)
    : null
  const singleMint = (latestMint == null && singlePostER != null)
    ? Math.min(100, Math.round((singlePostER / 3) * 100))
    : null

  const insights = [
    { Icon: Activity, body: 'Your Reels earn 3.2× more saves than photos this month.', cta: 'Post 2 more Reels this week', tone: 'teal' },
    { Icon: Clock,    body: 'Your audience peaks Thu 7–9pm but your last 3 posts went live at 1pm.', cta: 'Schedule Thu 7pm · ~+640 reach', tone: 'violet' },
    { Icon: MessageCircle, body: 'Mentions of "tutorial" spiked +40% — your audience wants to be taught.', cta: 'See sentiment & post ideas', tone: 'coral' },
  ]

  return (
    <>
      {/* Insight-flow style Pulse header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">Daily snapshot</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Live signal from your connected handles. Numbers reveal as our orchestrator finishes each pass.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span className="size-1.5 rounded-full bg-positive animate-pulse" />
          Streaming · 3 sources
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Mint Score"
            loadingDelay={0}
            value={mintScoreV2 ?? latestMint ?? singleMint ?? (hasData ? 75 : '--')}
            Icon={Sparkles}
            trend={trendMint}
            trendLabel={trendMint != null ? `${trendMint >= 0 ? '↑' : '↓'} ${Math.abs(trendMint).toFixed(0)}% vs first` : (mintScoreV2 != null ? '5-factor composite' : null)}
            sparkData={padSpark(sparks.mintScore)}
            sparkColor="teal"
            emptyHint="No posts yet"
          />
          <KpiCard
            label="Reach"
            loadingDelay={600}
            value={fmt(followers)}
            Icon={Radio}
            trend={trendReach}
            trendLabel={trendReach != null ? `${trendReach >= 0 ? '↑' : '↓'} ${Math.abs(trendReach).toFixed(0)}% likes` : null}
            sparkData={padSpark(sparks.likes)}
            sparkColor="sky"
            emptyHint="No posts yet"
          />
          <KpiCard
            label="Engagement"
            loadingDelay={1100}
            value={
              latestER != null     ? `${latestER.toFixed(2)}%`
              : singlePostER != null ? `${singlePostER.toFixed(2)}%`
              : engagement         ? `${engagement.toFixed(1)}%`
              : (hasData ? '—' : '--')
            }
            Icon={Heart}
            trend={trendER}
            trendLabel={trendER != null ? `${trendER >= 0 ? '↑' : '↓'} ${Math.abs(trendER).toFixed(0)}%` : null}
            sparkData={padSpark(sparks.engagementRate)}
            sparkColor="coral"
            emptyHint="No posts yet"
          />
          <KpiCard
            label="Audience mood"
            loadingDelay={1700}
            value={
              latestMood != null     ? `${latestMood.toFixed(1)}%`
              : singlePostMood != null ? `${singlePostMood.toFixed(1)}%`
              : (hasData ? '—' : '--')
            }
            Icon={Smile}
            trend={trendMood}
            trendLabel={trendMood != null ? `${trendMood >= 0 ? '↑' : '↓'} ${Math.abs(trendMood).toFixed(0)}% comment ratio` : null}
            sparkData={padSpark(sparks.commentsRatio)}
            sparkColor="violet"
            emptyHint="No posts yet"
          />
        </div>

        <SectionCard
          title="Brand DNA"
          subtitle="Deterministic identity extracted from your last posts."
          icon={<Brain className="size-4" strokeWidth={2} />}
          action={
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded bg-positive/10 text-positive">Analysis active</span>
          }
        >
          <BrandOverviewCard profile={profile} posts={posts} />
        </SectionCard>

        <ActivityCard stories={stories} posts={posts} loading={refreshing} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
          <InsightsCard insights={insights} isPaid={isPaid} onUpgrade={() => alert('Upgrade flow coming')} />
          <QuestsCard streak={0} />
        </div>
      </div>
    </>
  )
}
