/**
 * Content Lab — real post performance analysis powered by the Phase A
 * `posts` cluster action.
 *
 * Three sections:
 *   1. Best Performing Posts — grid sorted by engagement rate (likes +
 *      comments / followers). Each tile is clickable.
 *   2. Per-post breakdown — when a post is selected, expand a detailed
 *      card below the grid: full caption, hashtags, posting time, "why
 *      it worked" derived signals, link out to Instagram.
 *   3. Framework guide — prescriptive rules mined from the top 5 posts:
 *      optimal type, posting hour, day of week, caption length, hashtag
 *      count, mention usage. Each rule cites the data behind it.
 */

'use strict'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  LayoutGrid, Clock, Hash, Heart, MessageCircle, Eye, Play, Image as ImageIcon,
  Calendar, Sparkles, TrendingUp, AlertCircle, ExternalLink, Layers, Loader2,
  Sun, Moon, Coffee, Sunrise, ChevronRight, X as XIcon,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { fetchInstagramProfile, fetchInstagramPosts } from '../../../lib/apify'
import { proxyImg, fmt } from '../shared/utils'

/* ─── Caches ──────────────────────────────────────────────────────────── */
const CACHE_TTL = 15 * 60 * 1000
const cacheKey = (kind, h) => `contentlab:${kind}:v1:${h}`
function loadCache(kind, h) {
  if (!h || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(kind, h))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || (Date.now() - (data.t || 0)) > CACHE_TTL) return null
    return data.payload
  } catch { return null }
}
function saveCache(kind, h, payload) {
  if (!h || typeof localStorage === 'undefined') return
  try { localStorage.setItem(cacheKey(kind, h), JSON.stringify({ t: Date.now(), payload })) } catch {}
}

/* ─── Engagement math ──────────────────────────────────────────────────── */
function engagementRate(post, followers) {
  if (!followers || followers < 1) return null
  const reach = (post.likes || 0) + (post.comments || 0)
  return (reach / followers) * 100
}

// Heuristic 'why it worked' signal extraction for a single post given the
// distribution across all posts. Returns an array of { Icon, label, detail }.
function whyItWorked(post, allPosts, followers) {
  const out = []
  if (!post) return out
  const er = engagementRate(post, followers)
  if (followers && er != null) {
    const ers = allPosts.map((p) => engagementRate(p, followers)).filter((x) => x != null)
    const avg = ers.reduce((s, x) => s + x, 0) / Math.max(ers.length, 1)
    if (er > avg * 1.5) {
      out.push({ Icon: TrendingUp, label: `${er.toFixed(2)}% engagement rate`, detail: `${Math.round(((er / avg) - 1) * 100)}% above your average` })
    } else if (er > avg) {
      out.push({ Icon: TrendingUp, label: `${er.toFixed(2)}% engagement rate`, detail: 'Above your average' })
    } else {
      out.push({ Icon: TrendingUp, label: `${er.toFixed(2)}% engagement rate`, detail: 'Below your average' })
    }
  }
  // Type signal
  if (post.isCarousel) {
    out.push({ Icon: Layers, label: 'Carousel format', detail: 'Carousels lift saves + repeat viewing' })
  } else if (post.isVideo) {
    out.push({ Icon: Play, label: 'Video / Reel', detail: `${fmt(post.videoViews)} views — Reels surface beyond followers` })
  }
  // Time of day
  if (post.timestamp) {
    const d = new Date(post.timestamp)
    const hr = d.getHours()
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
    if (hr >= 18 && hr <= 22) {
      out.push({ Icon: Moon, label: `Posted at ${dow} ${hr}:00`, detail: 'Evening peak — high feed activity' })
    } else if (hr >= 5 && hr <= 9) {
      out.push({ Icon: Sunrise, label: `Posted at ${dow} ${hr}:00`, detail: 'Morning commute — feed-check moment' })
    } else if (hr >= 11 && hr <= 14) {
      out.push({ Icon: Coffee, label: `Posted at ${dow} ${hr}:00`, detail: 'Lunch break — second peak' })
    } else {
      out.push({ Icon: Sun, label: `Posted at ${dow} ${hr}:00`, detail: 'Off-peak hour' })
    }
  }
  // Hashtags
  const ht = (post.hashtags || []).length
  if (ht >= 5 && ht <= 12) {
    out.push({ Icon: Hash, label: `${ht} hashtags`, detail: 'Sweet-spot tag count for discovery' })
  } else if (ht > 12) {
    out.push({ Icon: Hash, label: `${ht} hashtags`, detail: 'High tag count — broad discovery' })
  } else if (ht > 0) {
    out.push({ Icon: Hash, label: `${ht} hashtag${ht > 1 ? 's' : ''}`, detail: 'Light tagging' })
  }
  // Caption length
  const capLen = (post.caption || '').length
  if (capLen >= 220) {
    out.push({ Icon: Sparkles, label: 'Long-form caption', detail: `${capLen} chars — invites a read` })
  } else if (capLen >= 60) {
    out.push({ Icon: Sparkles, label: 'Punchy caption', detail: `${capLen} chars — quick + clear` })
  } else if (capLen > 0) {
    out.push({ Icon: Sparkles, label: 'Minimal caption', detail: `${capLen} chars — image-led` })
  }
  return out
}

/* ─── Framework mining ────────────────────────────────────────────────── */
function mineFramework(posts, followers) {
  if (!posts || posts.length === 0) return null
  // Use top 5 by engagement rate as the "what works for you" anchor
  const sorted = [...posts]
    .map((p) => ({ ...p, er: engagementRate(p, followers) }))
    .filter((p) => p.er != null)
    .sort((a, b) => b.er - a.er)
  const top = sorted.slice(0, Math.min(5, sorted.length))
  if (top.length === 0) return null

  // Optimal type
  const typeCount = { image: 0, video: 0, carousel: 0 }
  for (const p of top) typeCount[p.type] = (typeCount[p.type] || 0) + 1
  const bestType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]
  const typePct = Math.round((bestType[1] / top.length) * 100)

  // Optimal hour
  const hours = top.map((p) => p.timestamp ? new Date(p.timestamp).getHours() : null).filter((h) => h != null)
  let bestHour = null
  let hourBucket = null
  if (hours.length > 0) {
    const tally = new Map()
    for (const h of hours) tally.set(h, (tally.get(h) || 0) + 1)
    bestHour = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0][0]
    hourBucket = bestHour >= 18 && bestHour <= 22 ? 'evening'
               : bestHour >= 11 && bestHour <= 14 ? 'midday'
               : bestHour >= 5 && bestHour <= 9 ? 'morning'
               : 'off-peak'
  }

  // Optimal day
  const days = top.map((p) => p.timestamp ? new Date(p.timestamp).getDay() : null).filter((d) => d != null)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  let bestDay = null
  if (days.length > 0) {
    const tally = new Map()
    for (const d of days) tally.set(d, (tally.get(d) || 0) + 1)
    bestDay = dayNames[Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0][0]]
  }

  // Caption length (median)
  const capLens = top.map((p) => (p.caption || '').length).filter((n) => n > 0)
  capLens.sort((a, b) => a - b)
  const medianCap = capLens.length ? capLens[Math.floor(capLens.length / 2)] : null

  // Hashtag count (median)
  const htCounts = top.map((p) => (p.hashtags || []).length)
  htCounts.sort((a, b) => a - b)
  const medianHt = htCounts.length ? htCounts[Math.floor(htCounts.length / 2)] : 0

  // Top hashtags across top posts
  const tagTally = new Map()
  for (const p of top) {
    for (const t of (p.hashtags || [])) tagTally.set(t, (tagTally.get(t) || 0) + 1)
  }
  const topTags = Array.from(tagTally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)

  // Mentions usage
  const mentionsUsed = top.filter((p) => (p.mentions || []).length > 0).length

  const avgEr = top.reduce((s, p) => s + (p.er || 0), 0) / top.length

  return {
    sampleSize: top.length,
    bestType: bestType[0],
    typePct,
    bestHour,
    hourBucket,
    bestDay,
    medianCap,
    medianHt,
    topTags,
    mentionsUsed,
    avgEr,
  }
}

/* ─── Sub-components ──────────────────────────────────────────────────── */
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

function PostTile({ post, followers, rank, isSelected, onSelect }) {
  const er = engagementRate(post, followers)
  const TypeIcon = post.isCarousel ? Layers : post.isVideo ? Play : ImageIcon
  const typeColor = post.isCarousel ? 'bg-amber-500'
    : post.isVideo ? 'bg-purple-500'
    : 'bg-emerald-500'
  return (
    <button
      onClick={() => onSelect(post)}
      className={`group relative bg-white rounded-2xl overflow-hidden border-2 ${
        isSelected ? 'border-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.2)]' : 'border-transparent'
      } shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:shadow-md transition-all text-left`}
      style={{ aspectRatio: '1 / 1' }}
    >
      {post.thumbnailUrl || post.mediaUrl ? (
        <img
          src={proxyImg(post.thumbnailUrl || post.mediaUrl)}
          alt={`Post ${rank}`}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-teal-100 to-indigo-100" />
      )}
      {/* Rank badge */}
      {rank <= 3 && (
        <div className="absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-white text-xs font-extrabold shadow-md">
          {rank}
        </div>
      )}
      {/* Type badge */}
      <div className={`absolute top-2 right-2 ${typeColor} text-white grid h-6 w-6 place-items-center rounded-full`}>
        <TypeIcon className="h-3 w-3" />
      </div>
      {/* Stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5">
        {er != null && (
          <div className="text-[10px] font-bold uppercase tracking-wide text-white/80">ER</div>
        )}
        <div className="text-white font-extrabold text-base leading-none">
          {er != null ? `${er.toFixed(1)}%` : fmt(post.likes)}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-white/85 font-medium">
          <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" /> {fmt(post.likes)}</span>
          <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" /> {fmt(post.comments)}</span>
          {post.isVideo && post.videoViews > 0 && (
            <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {fmt(post.videoViews)}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function BestPerformingGrid({ posts, followers, selectedShortcode, onSelect, loading }) {
  const ranked = useMemo(() => {
    if (!posts || posts.length === 0) return []
    return [...posts]
      .map((p) => ({ ...p, _er: engagementRate(p, followers) ?? 0 }))
      .sort((a, b) => b._er - a._er)
  }, [posts, followers])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Best performing posts</div>
          <div className="text-xs text-[#64756f]">
            Ranked by engagement rate (likes + comments / followers). Click any post to see why it worked.
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {loading && ranked.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      )}

      {!loading && ranked.length === 0 && (
        <div className="text-xs text-[#64756f] py-8 text-center">
          No posts found for this handle yet.
        </div>
      )}

      {ranked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ranked.slice(0, 12).map((post, i) => (
            <PostTile
              key={post.shortcode || i}
              post={post}
              followers={followers}
              rank={i + 1}
              isSelected={post.shortcode === selectedShortcode}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PerPostBreakdown({ post, allPosts, followers, onClose }) {
  if (!post) return null
  const signals = whyItWorked(post, allPosts, followers)
  const postedDate = post.timestamp ? new Date(post.timestamp) : null

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] animate-in fade-in duration-300">
      <div className="flex items-start gap-3 mb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Why this post worked</div>
          <div className="text-xs text-[#64756f]">Inspect each signal — combine the recurring ones into your next post.</div>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-[#64756f] hover:bg-[#f0f4f3]"
          title="Close"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Media */}
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-square">
            {post.thumbnailUrl || post.mediaUrl ? (
              <img
                src={proxyImg(post.thumbnailUrl || post.mediaUrl)}
                alt="Selected post"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : null}
          </div>
          <a
            href={post.url || `https://www.instagram.com/p/${post.shortcode}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> View on Instagram
          </a>
        </div>
        {/* Detail */}
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-rose-50 p-3 text-center">
              <Heart className="h-3.5 w-3.5 mx-auto text-rose-500 mb-1" />
              <div className="text-base font-extrabold text-rose-700">{fmt(post.likes)}</div>
              <div className="text-[10px] uppercase tracking-wider text-rose-600 font-bold">likes</div>
            </div>
            <div className="rounded-xl bg-violet-50 p-3 text-center">
              <MessageCircle className="h-3.5 w-3.5 mx-auto text-violet-500 mb-1" />
              <div className="text-base font-extrabold text-violet-700">{fmt(post.comments)}</div>
              <div className="text-[10px] uppercase tracking-wider text-violet-600 font-bold">comments</div>
            </div>
            <div className="rounded-xl bg-teal-50 p-3 text-center">
              {post.isVideo ? <Eye className="h-3.5 w-3.5 mx-auto text-teal-500 mb-1" /> : <TrendingUp className="h-3.5 w-3.5 mx-auto text-teal-500 mb-1" />}
              <div className="text-base font-extrabold text-teal-700">
                {post.isVideo ? fmt(post.videoViews) : (engagementRate(post, followers) != null ? `${engagementRate(post, followers).toFixed(1)}%` : '--')}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-teal-600 font-bold">
                {post.isVideo ? 'views' : 'er'}
              </div>
            </div>
          </div>

          {/* Why-it-worked signals */}
          {signals.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">Signals</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {signals.map((s, i) => {
                  const Icon = s.Icon
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-xl bg-[#f0f4f3] p-2.5">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-white text-violet-600 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold truncate">{s.label}</div>
                        <div className="text-[11px] text-[#64756f] truncate">{s.detail}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Caption */}
          {post.caption && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">Caption</div>
              <div className="rounded-xl bg-[#f0f4f3]/60 p-3 text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap max-h-44 overflow-y-auto">
                {post.caption}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">Hashtags ({post.hashtags.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <Hash className="h-2.5 w-2.5" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mentions */}
          {post.mentions?.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">Mentions ({post.mentions.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {post.mentions.map((m) => (
                  <a
                    key={m}
                    href={`https://www.instagram.com/${m}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
                  >
                    @{m}
                  </a>
                ))}
              </div>
            </div>
          )}

          {postedDate && (
            <div className="text-[11px] text-[#64756f]">
              Posted {postedDate.toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FrameworkGuide({ posts, followers, loading }) {
  const fw = useMemo(() => mineFramework(posts, followers), [posts, followers])

  const rules = useMemo(() => {
    if (!fw) return []
    const out = []
    // Rule 1 — content type
    const typeLabel = fw.bestType === 'carousel' ? 'Carousel' : fw.bestType === 'video' ? 'Video / Reel' : 'Photo'
    const TypeIcon = fw.bestType === 'carousel' ? Layers : fw.bestType === 'video' ? Play : ImageIcon
    out.push({
      Icon: TypeIcon,
      title: `Lead with ${typeLabel.toLowerCase()}`,
      detail: `${fw.typePct}% of your top ${fw.sampleSize} posts were ${typeLabel.toLowerCase()}s — keep this as your default content type until the data shifts.`,
    })
    // Rule 2 — posting hour
    if (fw.bestHour != null) {
      const Icon = fw.hourBucket === 'evening' ? Moon : fw.hourBucket === 'morning' ? Sunrise : fw.hourBucket === 'midday' ? Coffee : Sun
      out.push({
        Icon,
        title: `Post around ${fw.bestHour}:00`,
        detail: `Your strongest posts land in the ${fw.hourBucket} window. Schedule for ${fw.bestHour}:00 ± 1 hour.`,
      })
    }
    // Rule 3 — day of week
    if (fw.bestDay) {
      out.push({
        Icon: Calendar,
        title: `${fw.bestDay} is your day`,
        detail: `More of your top posts were published on ${fw.bestDay}s than any other day of the week.`,
      })
    }
    // Rule 4 — caption length
    if (fw.medianCap != null) {
      const tier = fw.medianCap >= 220 ? 'long-form (220+ chars)'
                 : fw.medianCap >= 60 ? 'punchy (60-220 chars)'
                 : 'minimal (<60 chars)'
      out.push({
        Icon: Sparkles,
        title: `Aim for ${tier} captions`,
        detail: `Median caption length across your top posts is ~${fw.medianCap} characters.`,
      })
    }
    // Rule 5 — hashtag count
    if (fw.medianHt > 0) {
      out.push({
        Icon: Hash,
        title: `Use ${fw.medianHt} hashtag${fw.medianHt > 1 ? 's' : ''} per post`,
        detail: fw.medianHt >= 5 && fw.medianHt <= 12
          ? 'In the discovery sweet-spot — keep it there.'
          : fw.medianHt > 12
            ? 'Above the typical sweet-spot but working for you. Don\'t shrink without testing.'
            : 'Lean tagging. If reach matters, test bumping to 5-12 tags.',
      })
    } else {
      out.push({
        Icon: Hash,
        title: 'Add hashtags',
        detail: 'Your top posts use 0 hashtags. Test 5-12 relevant tags on your next 3 posts to see if discovery lifts.',
      })
    }
    // Rule 6 — mentions
    if (fw.mentionsUsed > 0) {
      out.push({
        Icon: MessageCircle,
        title: 'Mention collaborators',
        detail: `${fw.mentionsUsed} of your top ${fw.sampleSize} include @mentions. Cross-tagging amplifies reach.`,
      })
    }
    // Rule 7 — top hashtags worth reusing
    if (fw.topTags.length > 0) {
      out.push({
        Icon: TrendingUp,
        title: 'Reuse your top-performing tags',
        detail: fw.topTags.map((t) => `#${t}`).join(' · '),
      })
    }
    return out
  }, [fw])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Your framework</div>
          <div className="text-xs text-[#64756f]">
            Prescriptive rules mined from your top {fw?.sampleSize || 5} posts. Apply to your next post and watch the ER move.
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {loading && rules.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      )}

      {!loading && !fw && (
        <div className="text-xs text-[#64756f] py-4 text-center">
          Not enough engagement data to mine a framework yet.
        </div>
      )}

      {rules.length > 0 && (
        <ol className="space-y-2">
          {rules.map((r, i) => {
            const Icon = r.Icon
            return (
              <li
                key={i}
                className="flex items-start gap-3 rounded-2xl bg-[#f0f4f3] p-3.5"
              >
                <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-white text-amber-600 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-200 text-amber-800 text-[10px] font-extrabold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[13px] font-bold">{r.title}</span>
                  </div>
                  <div className="text-[12px] text-[#64756f] mt-1 leading-snug">{r.detail}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#64756f] shrink-0 mt-1" />
              </li>
            )
          })}
        </ol>
      )}

      {fw && (
        <p className="mt-3 text-[11px] text-[#64756f]">
          Average ER across the top {fw.sampleSize}: <strong className="text-amber-700">{fw.avgEr.toFixed(2)}%</strong>. Beat this on your next post to lift the framework.
        </p>
      )}
    </div>
  )
}

/* ─── Main pane ───────────────────────────────────────────────────────── */
export default function ContentLabPane({ timeRange }) {
  const { user } = useAuth()
  const [handle, setHandle] = useState(null)
  const [handleLoading, setHandleLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [error, setError] = useState(null)
  const [selectedShortcode, setSelectedShortcode] = useState(null)

  // Resolve tracked handle
  useEffect(() => {
    if (!user) { setHandleLoading(false); return }
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
      setHandleLoading(false)
      if (error || !data) { setHandle(null); return }
      setHandle(data.username)
    })()
    return () => { cancelled = true }
  }, [user])

  // Hydrate (cache-then-refresh)
  const hydrate = useCallback(async (h) => {
    const cachedPosts = loadCache('posts', h)
    const cachedProfile = loadCache('profile', h)
    if (cachedPosts) setPosts(cachedPosts)
    if (cachedProfile) setProfile(cachedProfile)
    setLoadingPosts(true)
    setError(null)
    try {
      const [postsRes, profileRes] = await Promise.allSettled([
        fetchInstagramPosts(h, 24),
        fetchInstagramProfile(h),
      ])
      if (postsRes.status === 'fulfilled' && Array.isArray(postsRes.value)) {
        setPosts(postsRes.value)
        saveCache('posts', h, postsRes.value)
      } else if (postsRes.status === 'rejected') {
        console.warn('contentlab: posts fetch failed', postsRes.reason)
      }
      if (profileRes.status === 'fulfilled' && profileRes.value?.[0]) {
        setProfile(profileRes.value[0])
        saveCache('profile', h, profileRes.value[0])
      }
    } catch (err) {
      setError(err.message || 'Fetch failed')
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  const followers = profile?.followers ?? profile?.followersCount ?? null
  const selectedPost = useMemo(() => posts.find((p) => p.shortcode === selectedShortcode) || null, [posts, selectedShortcode])

  if (handleLoading) {
    return (
      <>
        <PaneHeader title="Content Lab" subtitle="Loading your tracked handle…" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
        </div>
      </>
    )
  }

  if (!handle) {
    return (
      <>
        <PaneHeader title="Content Lab" subtitle="Add an Instagram handle first" />
        <div className="rounded-3xl bg-white p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-center">
          <LayoutGrid className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <div className="font-bold text-slate-700 mb-1">No tracked handle yet</div>
          <div className="text-sm text-[#64756f]">
            Add an Instagram account to track on Pulse first, then come back here for post analysis.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        title="Content Lab"
        subtitle={followers != null
          ? `@${handle} · ${fmt(followers)} followers · ${timeRange}`
          : `@${handle} · ${timeRange}`}
        refreshing={loadingPosts}
      />

      <div className="space-y-4">
        <BestPerformingGrid
          posts={posts}
          followers={followers}
          selectedShortcode={selectedShortcode}
          onSelect={(p) => setSelectedShortcode(p.shortcode === selectedShortcode ? null : p.shortcode)}
          loading={loadingPosts}
        />

        {selectedPost && (
          <PerPostBreakdown
            post={selectedPost}
            allPosts={posts}
            followers={followers}
            onClose={() => setSelectedShortcode(null)}
          />
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        <FrameworkGuide
          posts={posts}
          followers={followers}
          loading={loadingPosts && posts.length === 0}
        />
      </div>
    </>
  )
}
