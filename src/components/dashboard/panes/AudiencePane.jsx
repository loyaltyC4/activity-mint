/**
 * Audience & Mood — real audience signal panels powered by the Phase A
 * cluster actions: top_commenters + audience_enrichment.
 *
 * Four cards:
 *   1. Top Commenters         — ranked list across the user's last N posts
 *   2. Audience Interest      — bio-hashtag aggregation across a sample of
 *                               followers, bucketed into themes
 *   3. Geographic Spread      — Leaflet map with bubbles per detected city,
 *                               loaded from a CDN so we don't add a build dep
 *   4. Audience Overlap       — compare your followers vs a competitor handle
 *
 * Loading strategy: each card fetches independently and renders skeletons
 * until its data lands. Cache the heavy results in localStorage (15 min TTL).
 */

'use strict'

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Users, Globe, Smile, MessageSquare, Hash, MapPin, Search,
  Heart, BadgeCheck, ArrowRight, Sparkles, Briefcase, Palette,
  Camera, Music, Coffee, ShoppingBag, Dumbbell, Plane, Code2,
  Loader2, AlertCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import {
  fetchTopCommenters,
  fetchAudienceEnrichment,
  fetchFollowersList,
} from '../../../lib/apify'
import { proxyImg, fmt } from '../shared/utils'

/* ─── Caches ───────────────────────────────────────────────────────────── */
const CACHE_TTL_MS = 15 * 60 * 1000
const cacheKey = (kind, handle) => `audience:${kind}:v1:${handle}`
function loadCache(kind, handle) {
  if (!handle || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(kind, handle))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || (Date.now() - (data.t || 0)) > CACHE_TTL_MS) return null
    return data.payload
  } catch { return null }
}
function saveCache(kind, handle, payload) {
  if (!handle || typeof localStorage === 'undefined') return
  try { localStorage.setItem(cacheKey(kind, handle), JSON.stringify({ t: Date.now(), payload })) } catch {}
}

/* ─── Interest buckets ────────────────────────────────────────────────── */
// Maps bio hashtags + bio keywords to themed buckets with a lucide icon
// each. Each entry: [Icon, label, regex matching word tokens]. Order matters
// (first match wins so more specific categories should come first).
const INTEREST_BUCKETS = [
  [Code2,       'Tech & developers', /\b(tech|developer|engineer|coding|programmer|software|startup|ai|ml|crypto|web3|saas)\b|#(tech|dev|coder|programming|ai|webdev)/i],
  [Briefcase,   'Business & founders', /\b(founder|ceo|entrepreneur|investor|business|finance|trader|coach)\b|#(business|founder|entrepreneur|hustle)/i],
  [Dumbbell,    'Fitness & wellness', /\b(fitness|gym|workout|trainer|athlete|wellness|yoga|run|coach)\b|#(fitness|gym|workout|fit|gains|wellness)/i],
  [Plane,       'Travel & explorers', /\b(travel|wanderlust|explore|adventure|nomad|backpack)\b|#(travel|wanderlust|explore|nomad)/i],
  [Palette,     'Art & design', /\b(art|artist|designer|illustrator|painter|sketch|creative)\b|#(art|artist|design|illustration)/i],
  [Camera,      'Photographers', /\b(photographer|photography|portraits|wedding photo)\b|#(photo|photography|photographer)/i],
  [Music,       'Music', /\b(musician|singer|producer|dj|songwriter|artist)\b|#(music|musician|artist|dj)/i],
  [Coffee,      'Food & lifestyle', /\b(foodie|chef|baker|recipe|cafe|coffee|brunch)\b|#(food|foodie|recipe|chef)/i],
  [ShoppingBag, 'Fashion & beauty', /\b(fashion|style|beauty|makeup|skincare|boutique|model)\b|#(fashion|style|ootd|beauty|makeup)/i],
  [Sparkles,    'Influencers & creators', /\b(creator|influencer|blogger|youtuber|content)\b|#(creator|content|influencer)/i],
]

function bucketFor(text) {
  if (!text) return null
  for (const [Icon, label, re] of INTEREST_BUCKETS) {
    if (re.test(text)) return { Icon, label }
  }
  return null
}

/* ─── City coordinate map (matches audience_enrichment.js CITY_HINTS) ──── */
const CITY_COORDS = {
  'New York':       { lat: 40.7128,  lng: -74.0060,  country: 'US'  },
  'Los Angeles':    { lat: 34.0522,  lng: -118.2437, country: 'US'  },
  'San Francisco':  { lat: 37.7749,  lng: -122.4194, country: 'US'  },
  'London':         { lat: 51.5074,  lng: -0.1278,   country: 'UK'  },
  'Paris':          { lat: 48.8566,  lng: 2.3522,    country: 'FR'  },
  'Berlin':         { lat: 52.5200,  lng: 13.4050,   country: 'DE'  },
  'Germany':        { lat: 51.1657,  lng: 10.4515,   country: 'DE'  },
  'Tokyo':          { lat: 35.6762,  lng: 139.6503,  country: 'JP'  },
  'Sydney':         { lat: -33.8688, lng: 151.2093,  country: 'AU'  },
  'Toronto':        { lat: 43.6532,  lng: -79.3832,  country: 'CA'  },
  'Dubai':          { lat: 25.2048,  lng: 55.2708,   country: 'AE'  },
  'India':          { lat: 20.5937,  lng: 78.9629,   country: 'IN'  },
  'Brazil':         { lat: -14.2350, lng: -51.9253,  country: 'BR'  },
  'Mexico City':    { lat: 19.4326,  lng: -99.1332,  country: 'MX'  },
  'Lagos':          { lat: 6.5244,   lng: 3.3792,    country: 'NG'  },
  'Amsterdam':      { lat: 52.3676,  lng: 4.9041,    country: 'NL'  },
  'Spain':          { lat: 40.4637,  lng: -3.7492,   country: 'ES'  },
  'Istanbul':       { lat: 41.0082,  lng: 28.9784,   country: 'TR'  },
  'Singapore':      { lat: 1.3521,   lng: 103.8198,  country: 'SG'  },
  'Seoul':          { lat: 37.5665,  lng: 126.9780,  country: 'KR'  },
  'Africa':         { lat: 0,        lng: 20,        country: 'AF'  },
}

/* ─── Pane header ──────────────────────────────────────────────────────── */
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

/* ─── Top Commenters Card ─────────────────────────────────────────────── */
function TopCommentersCard({ data, loading, error, handle }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
          <Heart className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Top commenters</div>
          <div className="text-xs text-[#64756f]">
            Most active accounts in @{handle || 'you'}’s last few posts — your most engaged audience
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {loading && data.length === 0 && (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3 rounded-full" />
                <Skeleton className="h-3 w-1/4 rounded-full" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && data.length === 0 && !error && (
        <div className="text-xs text-[#64756f] py-4 text-center">
          No commenters surfaced yet — try after a few posts have aged.
        </div>
      )}

      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {data.slice(0, 12).map((c, i) => (
            <a
              key={c.username}
              href={`https://www.instagram.com/${c.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-[#f0f4f3] transition-colors"
            >
              <div className="relative shrink-0">
                {c.profilePicUrl ? (
                  <img
                    src={proxyImg(c.profilePicUrl)}
                    alt={c.username}
                    className="h-10 w-10 rounded-full object-cover bg-slate-100"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-400 to-violet-400 text-white text-xs font-bold">
                    {(c.username[0] || '?').toUpperCase()}
                  </div>
                )}
                {i < 3 && (
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[10px] font-extrabold text-white shadow-[0_0_0_2px_white]">
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[13px] font-semibold truncate">
                  @{c.username}
                  {c.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
                </div>
                {c.samples?.[0] && (
                  <div className="text-[11px] text-[#64756f] truncate" title={c.samples[0]}>
                    {c.samples[0]}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-bold">{c.commentCount}</div>
                <div className="text-[10px] text-[#64756f]">comments</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Audience Interest Card ──────────────────────────────────────────── */
function AudienceInterestCard({ enrichedFollowers, loading }) {
  // Aggregate bio hashtags + bio text into themed buckets
  const buckets = useMemo(() => {
    if (!enrichedFollowers || enrichedFollowers.length === 0) return []
    const counts = new Map()
    for (const f of enrichedFollowers) {
      const text = [f.bio || '', ...(f.bioHashtags || []).map((h) => `#${h}`)].join(' ')
      const b = bucketFor(text)
      if (!b) continue
      const cur = counts.get(b.label) || { Icon: b.Icon, label: b.label, count: 0 }
      cur.count += 1
      counts.set(b.label, cur)
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count)
  }, [enrichedFollowers])

  const topHashtags = useMemo(() => {
    if (!enrichedFollowers || enrichedFollowers.length === 0) return []
    const tally = new Map()
    for (const f of enrichedFollowers) {
      for (const h of f.bioHashtags || []) {
        tally.set(h, (tally.get(h) || 0) + 1)
      }
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }))
  }, [enrichedFollowers])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Audience interest</div>
          <div className="text-xs text-[#64756f]">
            What your followers care about, extracted from their bios + hashtags
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      {loading && buckets.length === 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      )}

      {buckets.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-5">
            {buckets.slice(0, 8).map((b) => {
              const Icon = b.Icon
              const pct = Math.round((b.count / Math.max(enrichedFollowers.length, 1)) * 100)
              return (
                <div
                  key={b.label}
                  className="flex items-center gap-3 rounded-xl bg-[#f0f4f3] p-3"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-[9px] bg-white text-violet-600 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{b.label}</div>
                    <div className="text-[11px] text-[#64756f]">{b.count} follower{b.count > 1 ? 's' : ''} · {pct}%</div>
                  </div>
                </div>
              )
            })}
          </div>
          {topHashtags.length > 0 && (
            <>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#64756f]">
                Top bio hashtags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {topHashtags.map((h) => (
                  <span
                    key={h.tag}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
                  >
                    <Hash className="h-3 w-3" />
                    {h.tag}
                    <span className="text-violet-400">·{h.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!loading && buckets.length === 0 && (
        <div className="text-xs text-[#64756f] py-4 text-center">
          Not enough bio signal in the sample yet. Try a larger sample.
        </div>
      )}
    </div>
  )
}

/* ─── Geographic Spread Card (Leaflet via CDN) ─────────────────────────── */
function GeographicSpreadCard({ enrichedFollowers, loading }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  const cities = useMemo(() => {
    if (!enrichedFollowers || enrichedFollowers.length === 0) return []
    const tally = new Map()
    for (const f of enrichedFollowers) {
      const sig = f.citySignal
      if (!sig || sig.startsWith('flag:')) continue
      tally.set(sig, (tally.get(sig) || 0) + 1)
    }
    return Array.from(tally.entries())
      .filter(([name]) => CITY_COORDS[name])
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, ...CITY_COORDS[name] }))
  }, [enrichedFollowers])

  // Load Leaflet from CDN once
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.L) return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script')
      script.id = 'leaflet-js'
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
      script.crossOrigin = 'anonymous'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  // Initialize / refresh map whenever cities change AND Leaflet is loaded
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return
    let cancelled = false

    function ensureMap() {
      if (cancelled) return
      const L = window.L
      if (!L) {
        // Retry in 200ms until Leaflet loads (CDN race)
        setTimeout(ensureMap, 200)
        return
      }
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [20, 0],
          zoom: 1,
          minZoom: 1,
          worldCopyJump: true,
          zoomControl: true,
          attributionControl: false,
        })
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
          maxZoom: 18,
        }).addTo(mapRef.current)
      }
      // Clear existing markers
      for (const m of markersRef.current) {
        try { mapRef.current.removeLayer(m) } catch {}
      }
      markersRef.current = []
      // Add bubble per city
      const maxCount = Math.max(1, ...cities.map((c) => c.count))
      for (const c of cities) {
        const radius = 8 + (c.count / maxCount) * 22
        const circle = L.circleMarker([c.lat, c.lng], {
          radius,
          fillColor: '#14b8a6',
          fillOpacity: 0.55,
          color: '#0f766e',
          weight: 2,
          opacity: 0.9,
        }).addTo(mapRef.current)
        circle.bindTooltip(`${c.name} · ${c.count} follower${c.count > 1 ? 's' : ''}`, {
          permanent: false, direction: 'top',
        })
        markersRef.current.push(circle)
      }
      // Auto-fit if we have markers
      if (cities.length > 0) {
        const bounds = window.L.latLngBounds(cities.map((c) => [c.lat, c.lng]))
        mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 4 })
      }
    }
    ensureMap()
    return () => { cancelled = true }
  }, [cities])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Geographic spread</div>
          <div className="text-xs text-[#64756f]">
            Where your audience lives, extracted from follower bio location signals
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#64756f]" />}
      </div>

      <div className="rounded-2xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        <div
          ref={containerRef}
          className="h-72 bg-slate-50"
        />
      </div>

      {cities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cities.slice(0, 8).map((c) => (
            <span
              key={c.name}
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700"
            >
              <MapPin className="h-3 w-3" />
              {c.name}
              <span className="text-sky-400">·{c.count}</span>
            </span>
          ))}
        </div>
      )}
      {!loading && cities.length === 0 && (
        <div className="text-xs text-[#64756f] py-4 text-center">
          No clear city signal in the sample yet — try a larger sample or check followers with bio text.
        </div>
      )}
    </div>
  )
}

/* ─── Audience Overlap Card ───────────────────────────────────────────── */
function AudienceOverlapCard({ handle }) {
  const [competitor, setCompetitor] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleCompare = useCallback(async () => {
    const comp = competitor.trim().replace(/^@/, '')
    if (!comp || !handle) return
    setStatus('loading')
    setError('')
    try {
      const [oursRaw, theirsRaw] = await Promise.all([
        fetchFollowersList(handle, 'followers', 200),
        fetchFollowersList(comp, 'followers', 200),
      ])
      const ours = new Set((oursRaw || []).map((r) => r.username).filter(Boolean))
      const theirs = new Set((theirsRaw || []).map((r) => r.username).filter(Boolean))
      const overlap = []
      for (const u of ours) if (theirs.has(u)) overlap.push(u)
      const pct = Math.round((overlap.length / Math.max(ours.size, 1)) * 100)
      setResult({ ours: ours.size, theirs: theirs.size, overlap: overlap.length, pct, samples: overlap.slice(0, 12) })
      setStatus('success')
    } catch (err) {
      setError(err.message || 'Comparison failed')
      setStatus('error')
    }
  }, [competitor, handle])

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold">Audience overlap</div>
          <div className="text-xs text-[#64756f]">
            How many followers @{handle || 'you'} share with another handle. Useful for collab
            decisions and competitor analysis.
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-[#f0f4f3] px-3 py-2.5">
          <span className="text-[#64756f] text-sm">@</span>
          <input
            type="text"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCompare()}
            placeholder="competitor handle…"
            className="flex-1 bg-transparent border-none outline-none text-[13px] placeholder-slate-400"
            disabled={status === 'loading'}
          />
        </div>
        <button
          onClick={handleCompare}
          disabled={status === 'loading' || !competitor.trim() || !handle}
          className="rounded-xl bg-teal-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
        >
          {status === 'loading' ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Comparing…</>
          ) : (
            <><Search className="h-3.5 w-3.5" /> Compare</>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {status === 'success' && result && (
        <div className="mt-4">
          {/* Venn-style summary */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-teal-50 p-3 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-teal-700">@{handle} only</div>
              <div className="text-xl font-extrabold text-teal-700 mt-1">{fmt(result.ours - result.overlap)}</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 p-3 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Overlap</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">{fmt(result.overlap)}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">{result.pct}% of yours</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">@{competitor} only</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">{fmt(result.theirs - result.overlap)}</div>
            </div>
          </div>
          {result.samples.length > 0 && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64756f] mb-2">
                Shared followers (sample)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.samples.map((u) => (
                  <a
                    key={u}
                    href={`https://www.instagram.com/${u}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    @{u}
                  </a>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[11px] text-[#64756f]">
            Sampled from the most recent 200 followers of each handle. Overlap is approximate.
          </p>
        </div>
      )}

      {status === 'idle' && (
        <p className="text-[11px] text-[#64756f]">
          Enter another public Instagram handle to see how much of their audience already follows you.
        </p>
      )}
    </div>
  )
}

/* ─── Main pane ───────────────────────────────────────────────────────── */
export default function AudiencePane({ timeRange }) {
  const { user } = useAuth()

  const [handle, setHandle] = useState(null)
  const [handleLoading, setHandleLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [topCommenters, setTopCommenters] = useState({ items: [], loading: true, error: null })
  const [audience, setAudience] = useState({ items: [], loading: true, error: null })

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

  // Fetch top_commenters + audience_enrichment in parallel, with cache
  const hydrate = useCallback(async (h) => {
    // Instant paint from cache
    const tcCached = loadCache('top_commenters', h)
    const aeCached = loadCache('audience_enrichment', h)
    if (tcCached) setTopCommenters({ items: tcCached, loading: false, error: null })
    if (aeCached) setAudience({ items: aeCached, loading: false, error: null })

    setRefreshing(true)

    // Top commenters
    fetchTopCommenters(h, { postLimit: 4, commentLimit: 30, topN: 16 })
      .then((items) => {
        const arr = items || []
        setTopCommenters({ items: arr, loading: false, error: null })
        saveCache('top_commenters', h, arr)
      })
      .catch((err) => {
        setTopCommenters((prev) => ({ items: prev.items, loading: false, error: err.message }))
      })

    // Audience enrichment
    fetchAudienceEnrichment(h, 25, 0)
      .then((items) => {
        const arr = items || []
        setAudience({ items: arr, loading: false, error: null })
        saveCache('audience_enrichment', h, arr)
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

  if (handleLoading) {
    return (
      <>
        <PaneHeader title="Audience & Mood" subtitle="Loading your tracked handle…" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      </>
    )
  }

  if (!handle) {
    return (
      <>
        <PaneHeader title="Audience & Mood" subtitle="Add an Instagram handle first" />
        <div className="rounded-3xl bg-white p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <div className="font-bold text-slate-700 mb-1">No tracked handle yet</div>
          <div className="text-sm text-[#64756f]">
            Add an Instagram account to track on Pulse first, then come back here for audience signal.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        title="Audience & Mood"
        subtitle={`Who's listening — @${handle}, ${timeRange}`}
        refreshing={refreshing}
      />

      <div className="space-y-4">
        <TopCommentersCard
          data={topCommenters.items}
          loading={topCommenters.loading}
          error={topCommenters.error}
          handle={handle}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AudienceInterestCard
            enrichedFollowers={audience.items}
            loading={audience.loading}
          />
          <GeographicSpreadCard
            enrichedFollowers={audience.items}
            loading={audience.loading}
          />
        </div>

        <AudienceOverlapCard handle={handle} />
      </div>
    </>
  )
}
