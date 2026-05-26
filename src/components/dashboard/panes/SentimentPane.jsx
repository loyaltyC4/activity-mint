/**
 * Sentiment — comment analysis powered by top_commenters (which gives us
 * recent comment text samples across the user's last few posts).
 *
 * Computes:
 *   - Mood meter (% positive / neutral / negative) via a keyword-based
 *     sentiment scorer (no ML dep, fast, transparent)
 *   - Theme cloud (top words + hashtags from comments)
 *   - Watch list (comments that look like questions or negatives — the
 *     ones worth a reply)
 *
 * The text scoring is intentionally simple and inspectable: a positive
 * lexicon + a negative lexicon + question-mark detection. We can swap in
 * an LLM-based scorer later without changing the UI.
 */

'use strict'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  MessageSquare, Heart, AlertCircle, Sparkles, Hash, BadgeCheck,
  Smile, Frown, Meh, Loader2, MessageCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import { supabase } from '../../../lib/supabase'
// Speed-v5: dashboard-context Apify path for top_commenters
import { fetchDashboardTopCommenters } from '../../../lib/apify'
import { proxyImg } from '../shared/utils'

/* ─── Sentiment lexicons ──────────────────────────────────────────────── */
const POSITIVE = new Set([
  'love','loved','loving','amazing','awesome','beautiful','gorgeous','stunning',
  'perfect','best','great','greatest','incredible','inspiring','inspirational',
  'wow','fantastic','wonderful','fabulous','epic','dope','goals','queen','king',
  'icon','iconic','obsessed','favorite','favourite','wholesome','sweet','cute',
  'cutest','prettiest','handsome','flawless','superb','phenomenal','brilliant',
  'genius','legend','legendary','vibe','vibes','aesthetic','masterpiece','divine',
  'magical','breathtaking','elite','goated','fire','heart','heartfelt','blessed',
  'thank','thanks','thankyou','yes','yess','yesss','yay','woo','woohoo','hooray',
  'congrats','congratulations',
])

const NEGATIVE = new Set([
  'hate','hated','awful','terrible','horrible','worst','ugly','disgusting',
  'gross','bad','boring','dumb','stupid','trash','garbage','crap','sucks',
  'disappointing','disappointed','annoying','annoyed','cringe','fake','fraud',
  'scam','overrated','unfollow','blocked','rude','sad','depressing','meh',
  'tone-deaf','problematic','offensive','disgrace','toxic','ridiculous','wtf',
  'lame','flop','no','nope',
])

const STOPWORDS = new Set([
  'the','a','an','and','or','but','to','of','in','on','at','for','with','from','as',
  'is','are','was','were','be','been','being','am','do','did','does','have','has','had',
  'it','its','this','that','these','those','i','you','your','my','me','we','our','us','they','them','their',
  'so','if','then','than','too','also','just','very','really','much','more','most','some','any','no','not','one','two',
  'will','would','should','could','can','may','might','about','because','what','when','where','how','why','who',
])

/**
 * Crude but inspectable: tokenize, drop emoji-only/short tokens,
 * count POSITIVE/NEGATIVE matches, decide a label.
 */
function scoreText(text) {
  if (!text || typeof text !== 'string') return { label: 'neutral', score: 0, hasQuestion: false }
  const cleaned = text.toLowerCase()
  // Tokenize on whitespace + punctuation
  const tokens = cleaned.split(/[^\p{L}\p{N}_#]+/u).filter(Boolean)
  let pos = 0, neg = 0
  for (const t of tokens) {
    if (POSITIVE.has(t)) pos += 1
    if (NEGATIVE.has(t)) neg += 1
  }
  // Heart emoji = strong positive signal
  if (/[❤️♥️💖💕💗💓💞🥰😍🤩]/u.test(text)) pos += 1
  if (/[💔😢😭😡😤🤬]/u.test(text)) neg += 1
  // Excessive ?? often = curiosity > anger; treat as neutral but flag
  const hasQuestion = /[?]+/.test(text) && /\b(how|what|where|when|why|who|which|will|can|do|does|did|is|are|should)\b/i.test(text)
  let label = 'neutral'
  if (pos > neg && pos >= 1) label = 'positive'
  else if (neg > pos && neg >= 1) label = 'negative'
  return { label, score: pos - neg, hasQuestion }
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function flattenCommenters(commenters) {
  // top_commenters items: { username, samples: [text, ...], commentCount, ... }
  // We unfurl into a flat list of { username, fullName, profilePicUrl, text } records
  const out = []
  for (const c of commenters || []) {
    for (const sample of c.samples || []) {
      out.push({
        username: c.username,
        fullName: c.fullName,
        profilePicUrl: c.profilePicUrl,
        isVerified: c.isVerified,
        text: sample,
      })
    }
  }
  return out
}

/* ─── Pane header ─────────────────────────────────────────────────────── */
function PaneHeader({ title, subtitle, refreshing }) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
      </div>
      {refreshing && (
        <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]">
          <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> Refreshing…
        </span>
      )}
    </div>
  )
}

/* ─── Mood Meter ──────────────────────────────────────────────────────── */
function MoodMeter({ scored, loading }) {
  const breakdown = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 }
    for (const s of scored) counts[s.label] = (counts[s.label] || 0) + 1
    const total = counts.positive + counts.neutral + counts.negative
    if (total === 0) return null
    return {
      positive: Math.round((counts.positive / total) * 100),
      neutral: Math.round((counts.neutral / total) * 100),
      negative: Math.round((counts.negative / total) * 100),
      total,
    }
  }, [scored])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-3 mb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <Heart className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Mood meter</div>
          <div className="text-xs text-[#64756f]">
            Positive / neutral / negative breakdown of your recent commenters
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {!breakdown && loading && (
        <>
          <Skeleton className="h-3.5 w-full rounded-full" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </>
      )}

      {breakdown && (
        <>
          <div className="flex h-3.5 overflow-hidden rounded-full bg-[#f0f4f3] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            {breakdown.positive > 0 && <div className="h-full bg-emerald-500" style={{ width: `${breakdown.positive}%` }} />}
            {breakdown.neutral > 0  && <div className="h-full bg-slate-400"  style={{ width: `${breakdown.neutral}%`  }} />}
            {breakdown.negative > 0 && <div className="h-full bg-rose-500"   style={{ width: `${breakdown.negative}%` }} />}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <Smile className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
              <div className="text-lg font-extrabold text-emerald-700">{breakdown.positive}%</div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">positive</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <Meh className="h-4 w-4 mx-auto text-slate-500 mb-1" />
              <div className="text-lg font-extrabold text-slate-700">{breakdown.neutral}%</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">neutral</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-center">
              <Frown className="h-4 w-4 mx-auto text-rose-600 mb-1" />
              <div className="text-lg font-extrabold text-rose-700">{breakdown.negative}%</div>
              <div className="text-[10px] uppercase tracking-wider text-rose-600 font-bold">negative</div>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-[#64756f]">
            Scored across {breakdown.total} comment{breakdown.total > 1 ? 's' : ''} via keyword lexicon + emoji signal. Switch to an LLM scorer in Phase D.
          </p>
        </>
      )}

      {!breakdown && !loading && (
        <div className="text-xs text-[#64756f] py-4 text-center">
          No comments available to score yet — try after a few posts have aged.
        </div>
      )}
    </div>
  )
}

/* ─── Theme Cloud ─────────────────────────────────────────────────────── */
function ThemeCloud({ comments, loading }) {
  const themes = useMemo(() => {
    if (!comments || comments.length === 0) return { words: [], hashtags: [] }
    const wTally = new Map()
    const hTally = new Map()
    for (const c of comments) {
      const text = (c.text || '').toLowerCase()
      // Hashtags
      const tags = text.match(/#[\p{L}\p{N}_]+/gu) || []
      for (const t of tags) {
        const k = t.slice(1)
        hTally.set(k, (hTally.get(k) || 0) + 1)
      }
      // Words
      const tokens = text.split(/[^\p{L}\p{N}_]+/u).filter(Boolean)
      for (const w of tokens) {
        if (w.length < 4) continue
        if (STOPWORDS.has(w)) continue
        if (/^\d+$/.test(w)) continue
        wTally.set(w, (wTally.get(w) || 0) + 1)
      }
    }
    const words = Array.from(wTally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15)
    const hashtags = Array.from(hTally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
    return { words, hashtags }
  }, [comments])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-3 mb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">What people are saying</div>
          <div className="text-xs text-[#64756f]">Top words + hashtags surfacing in your comments</div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {loading && themes.words.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
        </div>
      )}

      {themes.words.length > 0 && (
        <>
          <div className="mb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">Top words</div>
            <div className="flex flex-wrap gap-1.5">
              {themes.words.map(([w, c], i) => {
                // Size by frequency: top words bigger
                const size = c >= 5 ? 'text-base' : c >= 3 ? 'text-sm' : 'text-xs'
                return (
                  <span
                    key={w}
                    className={`inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 ${size} font-medium text-violet-700`}
                  >
                    {w}
                    <span className="text-violet-400 text-[10px]">·{c}</span>
                  </span>
                )
              })}
            </div>
          </div>
          {themes.hashtags.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">Hashtags</div>
              <div className="flex flex-wrap gap-1.5">
                {themes.hashtags.map(([h, c]) => (
                  <span key={h} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    <Hash className="h-3 w-3" />
                    {h}
                    <span className="text-amber-400">·{c}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && themes.words.length === 0 && (
        <div className="text-xs text-[#64756f] py-4 text-center">No theme data yet.</div>
      )}
    </div>
  )
}

/* ─── Watch List ──────────────────────────────────────────────────────── */
function WatchList({ comments, loading }) {
  // Surface: negatives + questions — comments worth a reply
  const watch = useMemo(() => {
    const out = []
    for (const c of comments || []) {
      const s = scoreText(c.text)
      if (s.label === 'negative' || s.hasQuestion) {
        out.push({ ...c, ...s })
      }
      if (out.length >= 6) break
    }
    return out
  }, [comments])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-start gap-3 mb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Watch list</div>
          <div className="text-xs text-[#64756f]">Questions and negatives — these usually deserve a reply</div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {loading && watch.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#f0f4f3]/60 p-3 border-l-4 border-amber-400">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="mt-1.5 h-3 w-1/3 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {watch.length > 0 && (
        <div className="space-y-2">
          {watch.map((c, i) => {
            const borderColor = c.label === 'negative' ? 'border-rose-400' : 'border-amber-400'
            const bgColor = c.label === 'negative' ? 'bg-rose-50/60' : 'bg-amber-50/60'
            return (
              <div key={i} className={`rounded-xl ${bgColor} p-3 border-l-4 ${borderColor}`}>
                <div className="flex items-start gap-2.5">
                  {c.profilePicUrl ? (
                    <img
                      src={proxyImg(c.profilePicUrl)}
                      alt={c.username}
                      className="h-7 w-7 rounded-full object-cover bg-slate-100 shrink-0"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-400 to-violet-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-snug">{c.text}</div>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-[#64756f]">
                      <a
                        href={`https://www.instagram.com/${c.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold hover:underline"
                      >
                        @{c.username}
                      </a>
                      {c.isVerified && <BadgeCheck className="h-3 w-3 text-sky-500" />}
                      <span>·</span>
                      <span className={c.label === 'negative' ? 'text-rose-600' : 'text-amber-600'}>
                        {c.label === 'negative' ? 'Negative' : 'Question'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && watch.length === 0 && (
        <div className="text-xs text-[#64756f] py-4 text-center flex flex-col items-center gap-2">
          <Sparkles className="h-6 w-6 text-emerald-400" />
          <div>Quiet on the watch list — no flagged comments right now.</div>
        </div>
      )}
    </div>
  )
}

/* ─── Main pane ───────────────────────────────────────────────────────── */
export default function SentimentPane({ timeRange }) {
  const { user } = useAuth()
  const { handle, loading: handleLoading } = useTrackedAccount()
  const [commenters, setCommenters] = useState({ items: [], loading: true, error: null })
  const [refreshing, setRefreshing] = useState(false)

  // Resolve tracked handle

  // Fetch top_commenters
  const hydrate = useCallback(async (h) => {
    // Reuse audience cache to avoid double fetch
    const cacheRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(`audience:top_commenters:v1:${h}`) : null
    let cached = null
    try {
      const parsed = cacheRaw ? JSON.parse(cacheRaw) : null
      if (parsed && (Date.now() - (parsed.t || 0)) < 30 * 60 * 1000) cached = parsed.payload
    } catch {}
    if (cached) setCommenters({ items: cached, loading: false, error: null })
    setRefreshing(true)
    try {
      // topN:16 matches AudiencePane so both share the same cache entry
    const items = await fetchDashboardTopCommenters(h, { postLimit: 4, commentLimit: 30, topN: 16 })
      const arr = items || []
      setCommenters({ items: arr, loading: false, error: null })
      try { localStorage.setItem(`audience:top_commenters:v1:${h}`, JSON.stringify({ t: Date.now(), payload: arr })) } catch {}
    } catch (err) {
      setCommenters((prev) => ({ items: prev.items, loading: false, error: err.message }))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  // Flatten comments + score for downstream cards
  const flatComments = useMemo(() => flattenCommenters(commenters.items), [commenters.items])
  const scored = useMemo(() => flatComments.map((c) => ({ ...c, ...scoreText(c.text) })), [flatComments])

  if (handleLoading) {
    return (
      <>
        <PaneHeader title="Sentiment" subtitle="Loading your tracked handle…" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)}
        </div>
      </>
    )
  }

  if (!handle) {
    return (
      <>
        <PaneHeader title="Sentiment" subtitle="Add an Instagram handle first" />
        <div className="rounded-3xl bg-white p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-center">
          <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <div className="font-bold text-slate-700 mb-1">No tracked handle yet</div>
          <div className="text-sm text-[#64756f]">
            Add an Instagram account to track on Pulse first, then come back for sentiment analysis.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        title="Sentiment"
        subtitle={`What @${handle}'s audience is saying — ${timeRange}`}
        refreshing={refreshing}
      />

      <div className="space-y-4">
        <MoodMeter scored={scored} loading={commenters.loading} />
        <ThemeCloud comments={flatComments} loading={commenters.loading} />
        <WatchList comments={flatComments} loading={commenters.loading} />
      </div>
    </>
  )
}
