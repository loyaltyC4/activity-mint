/**
 * Outreach Ideas — real candidate profiles drawn from Phase A's
 * top_commenters and audience_enrichment actions.
 *
 * Three buckets:
 *   1. Super-engagers      — your most active commenters; best for
 *                            "thank you" / loyalty outreach
 *   2. Collab candidates   — followers with their own substantial
 *                            audience; best for partnership outreach
 *   3. Niche matches       — followers whose bio signal aligns with
 *                            your themes; best for community building
 *
 * Each card has a Sheet that opens with a draft DM script pre-filled
 * for that candidate type. The user can edit + copy in one click.
 */

'use strict'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  Phone, Send, Sparkles, MessageSquare, Heart, Users, Briefcase,
  ExternalLink, Copy, Check, BadgeCheck, Loader2, AlertCircle,
  Code2, Palette, Camera, Music, Coffee, ShoppingBag, Dumbbell,
  Plane, MapPin, MessageCircle, Mail,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
// Speed-v5: dashboard-context Apify path for top_commenters (faster cold,
// edge-cached warm). audience_enrichment stays on cluster.
import { fetchDashboardTopCommenters, fetchAudienceEnrichment } from '../../../lib/apify'
import { proxyImg, fmt } from '../shared/utils'

/* ─── Niche detection (same lexicon as AudiencePane) ─────────────────── */
const NICHE_BUCKETS = [
  [Code2,       'Tech',     /\b(tech|developer|engineer|coding|programmer|software|startup|ai|ml|crypto|web3|saas)\b|#(tech|dev|coder|programming|ai|webdev)/i],
  [Briefcase,   'Business', /\b(founder|ceo|entrepreneur|investor|business|finance|trader|coach)\b|#(business|founder|entrepreneur|hustle)/i],
  [Dumbbell,    'Fitness',  /\b(fitness|gym|workout|trainer|athlete|wellness|yoga|run|coach)\b|#(fitness|gym|workout|fit|gains|wellness)/i],
  [Plane,       'Travel',   /\b(travel|wanderlust|explore|adventure|nomad|backpack)\b|#(travel|wanderlust|explore|nomad)/i],
  [Palette,     'Art',      /\b(art|artist|designer|illustrator|painter|sketch|creative)\b|#(art|artist|design|illustration)/i],
  [Camera,      'Photo',    /\b(photographer|photography|portraits|wedding photo)\b|#(photo|photography|photographer)/i],
  [Music,       'Music',    /\b(musician|singer|producer|dj|songwriter)\b|#(music|musician|dj)/i],
  [Coffee,      'Food',     /\b(foodie|chef|baker|recipe|cafe|coffee|brunch)\b|#(food|foodie|recipe|chef)/i],
  [ShoppingBag, 'Fashion',  /\b(fashion|style|beauty|makeup|skincare|boutique|model)\b|#(fashion|style|ootd|beauty|makeup)/i],
  [Sparkles,    'Creator',  /\b(creator|influencer|blogger|youtuber|content)\b|#(creator|content|influencer)/i],
]

function detectNiche(text) {
  if (!text) return null
  for (const [Icon, label, re] of NICHE_BUCKETS) {
    if (re.test(text)) return { Icon, label }
  }
  return null
}

/* ─── DM script templates ─────────────────────────────────────────────── */
function dmScript(bucket, candidate, myHandle) {
  const u = candidate.username
  const first = (candidate.fullName || u).split(/[\s.\-_]/)[0]
  switch (bucket) {
    case 'super':
      return `Hi ${first}! 👋\n\nNoticed you've been engaging a lot with my posts lately — genuinely appreciate it. ` +
             `It means more than the algorithm ever shows.\n\n` +
             `I'm putting together something just for the people who actually show up in my comments — ` +
             `would you be open to seeing it first?\n\n` +
             `— @${myHandle}`
    case 'collab':
      return `Hey ${first}!\n\nBeen following your work and it lands really well with the kind of audience ` +
             `I'm building too. I think a joint Reel or post collab could land for both of us.\n\n` +
             `Open to a quick chat about it? Even just trading creative briefs first.\n\n` +
             `— @${myHandle}`
    case 'niche':
      return `Hi ${first}!\n\nSaw your bio${candidate.citySignal ? ` (and that you're in ${candidate.citySignal})` : ''} ` +
             `— we're working in the same space. Always trying to find more people who take this seriously.\n\n` +
             `Worth swapping notes? Happy to share what's been working on my end.\n\n` +
             `— @${myHandle}`
    default:
      return `Hi @${u}!\n\n— @${myHandle}`
  }
}

const BUCKET_META = {
  super: {
    Icon: Heart,
    label: 'Super-engagers',
    accent: 'rose',
    description: 'Your most active commenters. Already proven they care — convert them into advocates.',
  },
  collab: {
    Icon: Users,
    label: 'Collab candidates',
    accent: 'violet',
    description: 'Followers who have their own substantial audience. Best for partnership outreach.',
  },
  niche: {
    Icon: Sparkles,
    label: 'Niche matches',
    accent: 'teal',
    description: 'Followers whose bio signal aligns with your themes. Best for community building.',
  },
}

const ACCENT_BG = {
  rose:   'bg-rose-50',
  violet: 'bg-violet-50',
  teal:   'bg-teal-50',
}
const ACCENT_TEXT = {
  rose:   'text-rose-600',
  violet: 'text-violet-600',
  teal:   'text-teal-600',
}

/* ─── Caches ──────────────────────────────────────────────────────────── */
function loadShared(kind, h) {
  if (!h || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`audience:${kind}:v1:${h}`)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || (Date.now() - (data.t || 0)) > 15 * 60 * 1000) return null
    return data.payload
  } catch { return null }
}
function saveShared(kind, h, payload) {
  if (!h || typeof localStorage === 'undefined') return
  try { localStorage.setItem(`audience:${kind}:v1:${h}`, JSON.stringify({ t: Date.now(), payload })) } catch {}
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

/* ─── Candidate card ──────────────────────────────────────────────────── */
function CandidateCard({ candidate, bucket, onMessage }) {
  const meta = BUCKET_META[bucket]
  const niche = candidate.bio ? detectNiche(candidate.bio) : null
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
      {/* Avatar */}
      <div className="relative shrink-0">
        {candidate.profilePicUrl ? (
          <img
            src={proxyImg(candidate.profilePicUrl)}
            alt={candidate.username}
            className="h-11 w-11 rounded-full object-cover bg-slate-100"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className={`grid h-11 w-11 place-items-center rounded-full ${ACCENT_BG[meta.accent]} ${ACCENT_TEXT[meta.accent]} text-[15px] font-bold`}>
            {(candidate.username[0] || '?').toUpperCase()}
          </div>
        )}
        {candidate.isVerified && (
          <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-sky-500 bg-white rounded-full" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold truncate">@{candidate.username}</span>
          {niche && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
              <niche.Icon className="h-2.5 w-2.5" /> {niche.label}
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#64756f] truncate">
          {candidate.signal}
          {candidate.citySignal && !candidate.citySignal.startsWith('flag:') && (
            <span className="inline-flex items-center gap-0.5 ml-1.5">
              <MapPin className="h-2.5 w-2.5" /> {candidate.citySignal}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={`https://www.instagram.com/${candidate.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-8 w-8 place-items-center rounded-lg text-[#64756f] hover:bg-[#f0f4f3]"
          title="Open profile on Instagram"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={() => onMessage(candidate, bucket)}
          className={`inline-flex items-center gap-1 rounded-lg ${ACCENT_BG[meta.accent]} ${ACCENT_TEXT[meta.accent]} px-2.5 py-1.5 text-[11px] font-bold hover:opacity-80 transition-opacity`}
        >
          <Send className="h-3 w-3" />
          Message
        </button>
      </div>
    </div>
  )
}

/* ─── Bucket section ──────────────────────────────────────────────────── */
function BucketSection({ bucket, candidates, loading, error, onMessage }) {
  const meta = BUCKET_META[bucket]
  const Icon = meta.Icon
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${ACCENT_BG[meta.accent]} ${ACCENT_TEXT[meta.accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">{meta.label}</div>
          <div className="text-xs text-[#64756f]">{meta.description}</div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {loading && candidates.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
              <Skeleton className="h-11 w-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3 rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
              </div>
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {!loading && candidates.length === 0 && !error && (
        <div className="text-xs text-[#64756f] py-4 text-center">
          No candidates surfaced yet. Try again once Phase A enrichment has had time to run.
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <CandidateCard
              key={c.username + '::' + i}
              candidate={c}
              bucket={bucket}
              onMessage={onMessage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── DM sheet ────────────────────────────────────────────────────────── */
function DMSheet({ open, onOpenChange, candidate, bucket, myHandle }) {
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (candidate && bucket) {
      setDraft(dmScript(bucket, candidate, myHandle || 'you'))
      setCopied(false)
    }
  }, [candidate, bucket, myHandle])

  const handleCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [draft])

  if (!candidate) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-hidden">
        <SheetHeader className="p-6 pb-3">
          <SheetTitle className="flex items-center gap-3">
            {candidate.profilePicUrl ? (
              <img
                src={proxyImg(candidate.profilePicUrl)}
                alt={candidate.username}
                className="h-10 w-10 rounded-full object-cover bg-slate-100"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-teal-100 text-teal-700 text-sm font-bold">
                {(candidate.username[0] || '?').toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate">@{candidate.username}</span>
                {candidate.isVerified && <BadgeCheck className="h-4 w-4 text-sky-500 shrink-0" />}
              </div>
              {candidate.fullName && (
                <div className="text-xs font-normal text-[#64756f] truncate">{candidate.fullName}</div>
              )}
            </div>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Draft DM tailored for the <strong>{BUCKET_META[bucket]?.label}</strong> bucket. Edit before sending.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Profile summary */}
          <div className="rounded-xl bg-[#f0f4f3] p-3 text-[12px] space-y-1">
            {candidate.followerCount != null && (
              <div className="flex justify-between">
                <span className="text-[#64756f]">Followers</span>
                <span className="font-semibold">{fmt(candidate.followerCount)}</span>
              </div>
            )}
            {candidate.followingCount != null && (
              <div className="flex justify-between">
                <span className="text-[#64756f]">Following</span>
                <span className="font-semibold">{fmt(candidate.followingCount)}</span>
              </div>
            )}
            {candidate.commentCount != null && (
              <div className="flex justify-between">
                <span className="text-[#64756f]">Comments on your posts</span>
                <span className="font-semibold">{candidate.commentCount}</span>
              </div>
            )}
            {candidate.signal && (
              <div className="text-[11px] text-[#64756f] pt-1 border-t border-[#e0eae7]">
                {candidate.signal}
              </div>
            )}
          </div>

          {/* Bio */}
          {candidate.bio && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-1.5">Their bio</div>
              <div className="rounded-xl bg-[#f0f4f3]/60 p-3 text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                {candidate.bio}
              </div>
            </div>
          )}

          {/* DM textarea */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-1.5">Draft message</div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={9}
              className="w-full rounded-xl border border-[#e0eae7] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 resize-none"
              placeholder="Write your DM…"
            />
            <div className="mt-1 text-[10px] text-[#64756f] text-right">{draft.length} chars</div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-teal-600 transition-colors"
            >
              {copied ? (
                <><Check className="h-4 w-4" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4" /> Copy message</>
              )}
            </button>
            <a
              href={`https://www.instagram.com/${candidate.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e0eae7] bg-white px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-[#f0f4f3] transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Open profile
            </a>
          </div>
          <p className="text-[11px] text-[#64756f]">
            Instagram doesn't allow pre-filled DMs from the web, so you'll need to paste the message manually
            once you click into the conversation.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Main pane ───────────────────────────────────────────────────────── */
export default function OutreachPane({ timeRange }) {
  const { user } = useAuth()
  const [handle, setHandle] = useState(null)
  const [handleLoading, setHandleLoading] = useState(true)
  const [topCommenters, setTopCommenters] = useState({ items: [], loading: true, error: null })
  const [audience, setAudience] = useState({ items: [], loading: true, error: null })
  const [refreshing, setRefreshing] = useState(false)
  const [sheetCandidate, setSheetCandidate] = useState(null)
  const [sheetBucket, setSheetBucket] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

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

  // Hydrate: shared cache with AudiencePane and SentimentPane
  const hydrate = useCallback(async (h) => {
    const tcCached = loadShared('top_commenters', h)
    const aeCached = loadShared('audience_enrichment', h)
    if (tcCached) setTopCommenters({ items: tcCached, loading: false, error: null })
    if (aeCached) setAudience({ items: aeCached, loading: false, error: null })

    setRefreshing(true)

    fetchDashboardTopCommenters(h, { postLimit: 4, commentLimit: 30, topN: 16 })
      .then((items) => {
        const arr = items || []
        setTopCommenters({ items: arr, loading: false, error: null })
        saveShared('top_commenters', h, arr)
      })
      .catch((err) => {
        setTopCommenters((prev) => ({ items: prev.items, loading: false, error: err.message }))
      })

    fetchAudienceEnrichment(h, 25, 0)
      .then((items) => {
        const arr = items || []
        setAudience({ items: arr, loading: false, error: null })
        saveShared('audience_enrichment', h, arr)
      })
      .catch((err) => {
        setAudience((prev) => ({ items: prev.items, loading: false, error: err.message }))
      })
      .finally(() => setRefreshing(false))
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  // Bucket the candidates
  const buckets = useMemo(() => {
    // 1) Super-engagers: top_commenters items
    const superEngagers = topCommenters.items.slice(0, 8).map((c) => ({
      username: c.username,
      fullName: c.fullName,
      profilePicUrl: c.profilePicUrl,
      isVerified: c.isVerified,
      followerCount: null,
      followingCount: null,
      bio: null,
      citySignal: null,
      commentCount: c.commentCount,
      signal: `${c.commentCount} comment${c.commentCount > 1 ? 's' : ''} on your recent posts`,
    }))

    // 2) Collab candidates: enriched followers with >= 1000 followers, sorted desc
    const collab = [...audience.items]
      .filter((f) => (f.followerCount ?? 0) >= 1000)
      .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
      .slice(0, 8)
      .map((f) => ({
        ...f,
        signal: `${fmt(f.followerCount)} followers${f.category ? ' · ' + f.category : ''}`,
      }))

    // 3) Niche matches: enriched followers with detected niche, excluded if already in collab
    const collabSet = new Set(collab.map((c) => c.username))
    const niche = audience.items
      .filter((f) => !collabSet.has(f.username))
      .map((f) => ({ ...f, _niche: f.bio ? detectNiche(f.bio) : null }))
      .filter((f) => f._niche)
      .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0))
      .slice(0, 8)
      .map((f) => ({
        ...f,
        signal: `${f._niche.label}${f.followerCount ? ' · ' + fmt(f.followerCount) + ' followers' : ''}`,
      }))

    return { super: superEngagers, collab, niche }
  }, [topCommenters.items, audience.items])

  const handleMessage = useCallback((candidate, bucket) => {
    setSheetCandidate(candidate)
    setSheetBucket(bucket)
    setSheetOpen(true)
  }, [])

  if (handleLoading) {
    return (
      <>
        <PaneHeader title="Outreach Ideas" subtitle="Loading your tracked handle…" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)}
        </div>
      </>
    )
  }

  if (!handle) {
    return (
      <>
        <PaneHeader title="Outreach Ideas" subtitle="Add an Instagram handle first" />
        <div className="rounded-3xl bg-white p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-center">
          <Phone className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <div className="font-bold text-slate-700 mb-1">No tracked handle yet</div>
          <div className="text-sm text-[#64756f]">
            Add an Instagram account to track on Pulse first, then come back here for tailored outreach picks.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        title="Outreach Ideas"
        subtitle={`Who to message — @${handle}, ${timeRange}`}
        refreshing={refreshing}
      />

      <div className="space-y-4">
        <BucketSection
          bucket="super"
          candidates={buckets.super}
          loading={topCommenters.loading}
          error={topCommenters.error}
          onMessage={handleMessage}
        />
        <BucketSection
          bucket="collab"
          candidates={buckets.collab}
          loading={audience.loading}
          error={audience.error}
          onMessage={handleMessage}
        />
        <BucketSection
          bucket="niche"
          candidates={buckets.niche}
          loading={audience.loading}
          error={audience.error}
          onMessage={handleMessage}
        />
      </div>

      <DMSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidate={sheetCandidate}
        bucket={sheetBucket}
        myHandle={handle}
      />
    </>
  )
}
