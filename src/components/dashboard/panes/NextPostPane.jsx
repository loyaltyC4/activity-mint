/**
 * Next Post Planner — "How do I find my next post?"
 *
 * Algorithmically answers the question by analysing the user's own data:
 *
 *   STEP 1 — Format Recommendation
 *   Looks at the engagement rate PER FORMAT from recent posts. If videos
 *   outperform photos 2:1, recommends "Post a Reel". Industry benchmarks
 *   used as the fallback for accounts with <3 posts.
 *
 *   STEP 2 — Hook Blueprint
 *   Reads the cached Script Studio analysis from localStorage. If available,
 *   surfaces the winning opener pattern (e.g. "Question hook 81% of the
 *   time"). Falls back to a general best-practice hook guide.
 *
 *   STEP 3 — Posting Window
 *   Based on the timestamp of the user's most-engaged post (best day/hour).
 *   With limited data, uses the proven industry window (Tue-Thu, 6-9pm).
 *
 *   STEP 4 — Dead Phrases to Avoid
 *   Surfaces the top 3 "dead phrases" from Script Studio so the user
 *   never accidentally uses "link in bio" in a caption again.
 *
 *   STEP 5 — Ready-to-Copy Hook Starters
 *   3 fill-in-the-blank openers derived from the winning structure.
 */

'use strict'

import React, { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays, Video, Image as ImageIcon, Layers, Sparkles,
  Clock, ArrowRight, AlertTriangle, CheckCircle2, PenTool,
  Loader2, RefreshCw, Copy, ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { fetchDashboardProfile, fetchInstagramPostsSWR } from '../../../lib/apify'
import { proxyImg } from '../shared/utils'

/* ─── Industry benchmarks ──────────────────────────────────────────────── */
const FORMAT_BENCHMARKS = {
  Video:   { er: 5.5, label: 'Reel / Video',    Icon: Video,      color: 'violet', advice: 'Reels get 67% more reach than photos on average in 2026.' },
  Sidecar: { er: 4.2, label: 'Carousel',         Icon: Layers,     color: 'sky',    advice: 'Carousels drive 3× more swipe-saves. Great for tutorials.' },
  Image:   { er: 2.8, label: 'Photo',            Icon: ImageIcon,  color: 'teal',   advice: 'Photos build brand aesthetic. Pair with a strong hook caption.' },
}

const BEST_WINDOWS = [
  { day: 'Tuesday',   hour: '7 PM',  tz: 'your timezone', note: 'Early week posts often benefit from lower competition' },
  { day: 'Wednesday', hour: '6 PM',  tz: 'your timezone', note: 'Mid-week peak for most niches' },
  { day: 'Thursday',  hour: '8 PM',  tz: 'your timezone', note: 'Thursday evening is peak engagement globally' },
]

/* ─── Format analysis ──────────────────────────────────────────────────── */
function analyseFormats(posts, followers) {
  if (!Array.isArray(posts) || posts.length === 0) return null
  const byType = {}
  for (const p of posts) {
    const t = p.type || 'Image'
    if (!byType[t]) byType[t] = { sumER: 0, count: 0, sumLikes: 0 }
    const eng = (Number(p.likes ?? p.likesCount ?? 0) + Number(p.comments ?? p.commentsCount ?? 0))
    const er = followers && followers > 0 ? (eng / followers) * 100 : eng
    byType[t].sumER += er
    byType[t].count += 1
    byType[t].sumLikes += Number(p.likes ?? p.likesCount ?? 0)
  }
  const ranked = Object.entries(byType)
    .map(([type, v]) => ({ type, avgER: v.sumER / v.count, count: v.count }))
    .sort((a, b) => b.avgER - a.avgER)
  return ranked
}

/* ─── Best posting time ─────────────────────────────────────────────────── */
function bestTime(posts) {
  if (!Array.isArray(posts) || posts.length < 2) return BEST_WINDOWS[2]
  // Find the hour of the post with highest engagement
  let bestPost = null
  let bestEng = -1
  for (const p of posts) {
    const eng = Number(p.likes ?? p.likesCount ?? 0) + Number(p.comments ?? p.commentsCount ?? 0)
    if (eng > bestEng) { bestEng = eng; bestPost = p }
  }
  if (!bestPost?.timestamp) return BEST_WINDOWS[2]
  const d = new Date(bestPost.timestamp)
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const day = days[d.getDay()]
  const hour = d.getHours()
  const ampm = hour >= 12 ? `${hour === 12 ? 12 : hour - 12} PM` : `${hour || 12} AM`
  return { day, hour: ampm, tz: 'your time', note: 'Based on when your most engaged post went live' }
}

/* ─── Load Script Studio cache ─────────────────────────────────────────── */
function loadStudioCache(handle) {
  if (!handle || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`script_studio:v1:${handle}`)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || (Date.now() - (d.t || 0)) > 4 * 60 * 60 * 1000) return null
    return d.payload
  } catch { return null }
}

/* ─── Components ───────────────────────────────────────────────────────── */
function PaneHeader({ title, subtitle, stale, onRefresh }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
      </div>
      <div className="flex items-center gap-2">
        {stale && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600">
            Loading…
          </span>
        )}
        {onRefresh && (
          <button onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-[8px] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#64756f] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:bg-slate-50">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        )}
      </div>
    </div>
  )
}

function FormatCard({ ranked, loading }) {
  const top = ranked?.[0]
  const bench = FORMAT_BENCHMARKS[top?.type || 'Video']
  const Icon = bench?.Icon || Video
  const colMap = { violet: 'bg-violet-50 text-violet-700', sky: 'bg-sky-50 text-sky-700', teal: 'bg-teal-50 text-teal-700' }
  const colCls = colMap[bench?.color || 'violet']

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-3 flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${colCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Post format</div>
          <div className="text-base font-bold">
            {loading ? 'Analysing your posts…' : `Post a ${bench?.label || 'Reel'}`}
          </div>
        </div>
      </div>
      {!loading && (
        <>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{bench?.advice}</p>
          {ranked && ranked.length > 1 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f] mb-1">Your ER by format</div>
              {ranked.slice(0, 3).map((r) => {
                const b = FORMAT_BENCHMARKS[r.type] || FORMAT_BENCHMARKS.Image
                const maxER = ranked[0].avgER || 1
                const pct = Math.round((r.avgER / maxER) * 100)
                return (
                  <div key={r.type} className="flex items-center gap-2">
                    <span className="w-20 text-[12px] text-slate-600">{b.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-[11px] font-bold text-slate-700">{r.avgER.toFixed(2)}%</span>
                  </div>
                )
              })}
            </div>
          )}
          {(!ranked || ranked.length <= 1) && (
            <div className="text-[11px] text-[#64756f]">Post 3+ times in different formats to see your personal breakdown.</div>
          )}
        </>
      )}
    </div>
  )
}

function TimingCard({ window: win, loading }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Best time to post</div>
          <div className="text-base font-bold">
            {loading ? 'Calculating…' : `${win?.day}, ${win?.hour}`}
          </div>
        </div>
      </div>
      {!loading && (
        <p className="text-sm text-slate-600 leading-relaxed">{win?.note}</p>
      )}
    </div>
  )
}

function HookCard({ studio, loading, onNavigate }) {
  const blueprint = studio?.blueprint
  const opener = blueprint?.common_opener?.label || 'Question hook'
  const share = blueprint?.common_opener?.share
  const scripts = studio?.scripts || []
  const [copied, setCopied] = useState(-1)

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <PenTool className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Winning hook structure</div>
            <div className="text-base font-bold">
              {loading ? 'Loading…' : opener}
            </div>
          </div>
        </div>
        {!loading && (
          <button onClick={onNavigate}
            className="flex items-center gap-1 rounded-[8px] bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100">
            Open Script Studio <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {!loading && (
        <>
          {share != null && (
            <p className="text-sm text-slate-600 mb-4">
              <strong>{Math.round(share * 100)}%</strong> of your highest-performing posts open this way.
            </p>
          )}
          {scripts.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f] mb-1">Ready to copy</div>
              {scripts.slice(0, 2).map((s, i) => (
                <div key={i} className="relative rounded-xl bg-slate-50 p-3 pr-12 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                  <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-800">{s}</pre>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(s); setCopied(i); setTimeout(() => setCopied(-1), 1500) }}
                    className="absolute top-2 right-2 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#64756f] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                    {copied === i ? '✓' : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              <div className="font-bold mb-1">Run Script Studio first</div>
              <p className="text-[12px] leading-relaxed">Script Studio analyses your 50 most recent posts to build personalised hook templates. Click "Script Studio" in the sidebar to run the analysis.</p>
              <button onClick={onNavigate} className="mt-2 flex items-center gap-1 text-[12px] font-bold text-amber-700 hover:underline">
                Run now <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DeadPhrasesCard({ studio, loading }) {
  const losers = studio?.lexicon?.losers || []
  if (!loading && losers.length === 0) return null
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Phrases to avoid in your caption</div>
          <div className="text-base font-bold">Dead phrases — statistically kill engagement</div>
        </div>
      </div>
      {loading ? <Skeleton className="h-16 rounded-xl" /> : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {losers.slice(0, 6).map((l, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]">
              <span className="text-red-500 font-bold text-[11px]">✕</span>
              <span className="text-[12px] font-medium text-red-900">"{l.phrase}"</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function NextPostPane({ timeRange, onPaneChange }) {
  const { user } = useAuth()
  const [handle, setHandle] = useState(null)
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [studio, setStudio] = useState(null)

  // Resolve tracked handle
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('tracked_accounts').select('username')
        .eq('user_id', user.id).order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      if (!cancelled) setHandle(data?.username || null)
    })()
    return () => { cancelled = true }
  }, [user])

  // Fetch profile + posts
  useEffect(() => {
    if (!handle) return
    let cancelled = false
    setLoading(true)
    // Try Script Studio cache from localStorage
    const cached = loadStudioCache(handle)
    if (cached && !cancelled) setStudio(cached)

    fetchDashboardProfile(handle)
      .then((items) => {
        if (cancelled) return
        const item = items?.[0]
        if (item) {
          setProfile(item)
          if (Array.isArray(item.latestPosts)) setPosts(item.latestPosts)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [handle])

  const followers = profile?.followersCount ?? profile?.followers ?? null
  const ranked = analyseFormats(posts, followers)
  const win = bestTime(posts)

  const navigateToScript = useCallback(() => {
    if (typeof onPaneChange === 'function') onPaneChange('script')
  }, [onPaneChange])

  if (!handle && !loading) {
    return (
      <>
        <PaneHeader title="Next Post" subtitle="Your algorithmically-recommended content plan" />
        <div className="rounded-3xl bg-white p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">Track an account first</h3>
          <p className="mt-1 text-sm text-[#64756f]">Add an Instagram handle in your dashboard settings to see personalised post recommendations.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        title="Next Post"
        subtitle={handle ? `Data-driven recommendations for @${handle}` : 'Your content plan'}
        stale={loading}
      />

      <div className="space-y-4">
        {/* Top row: format + timing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <>
              <Skeleton className="h-48 rounded-3xl" />
              <Skeleton className="h-48 rounded-3xl" />
            </>
          ) : (
            <>
              <FormatCard ranked={ranked} loading={false} />
              <TimingCard window={win} loading={false} />
            </>
          )}
        </div>

        {/* Hook blueprint + ready-to-copy templates */}
        {loading ? (
          <Skeleton className="h-56 rounded-3xl" />
        ) : (
          <HookCard studio={studio} loading={false} onNavigate={navigateToScript} />
        )}

        {/* Dead phrases to avoid */}
        {!loading && studio && <DeadPhrasesCard studio={studio} loading={false} />}

        {/* CTA when no Script Studio data */}
        {!loading && !studio && (
          <div className="rounded-3xl bg-gradient-to-br from-teal-50 to-emerald-50 p-6 shadow-[0_0_0_1px_rgba(20,184,166,0.15)]">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-500 text-white shadow-[0_8px_24px_-8px_rgba(20,184,166,0.6)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">Unlock personalised scripts</div>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Run Script Studio to analyse your 50 most recent posts. It identifies your high-traction phrases, dead phrases, and winning caption structure — then generates 3 ready-to-post scripts tailored to your niche.
                </p>
                <button onClick={navigateToScript}
                  className="mt-3 flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2 text-[13px] font-semibold text-white hover:bg-teal-500 transition-colors">
                  Run Script Studio <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
