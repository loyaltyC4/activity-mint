/**
 * Ad Lab — Meta Ad Library longevity tracker.
 *
 * The premise: Meta's Ad Library tells you what's RUNNING, not what's
 * actually scaling. An ad live for 1 day might be losing money. An ad
 * live for 30+ days with multiple creative variants is almost certainly
 * profitable — Meta wouldn't keep serving it otherwise.
 *
 * This pane lets users enter a competitor's Facebook page URL/ID,
 * then sorts their active ads by days_running. Top ads are the scaling
 * winners worth copying.
 */

'use strict'

import React, { useState, useEffect } from 'react'
import {
  Megaphone, Search, Calendar, TrendingUp, ExternalLink,
  AlertCircle, Loader2, Copy, Sparkles,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchAdLibrary } from '../../../lib/apify'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_KEY = (k) => `ad_library:v1:${k}`
function loadCache(k) {
  if (!k || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY(k))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || (Date.now() - (d.t || 0)) > CACHE_TTL_MS) return null
    return d.payload
  } catch { return null }
}
function saveCache(k, payload) {
  if (!k || typeof localStorage === 'undefined') return
  try { localStorage.setItem(CACHE_KEY(k), JSON.stringify({ t: Date.now(), payload })) } catch {}
}

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

/**
 * Try to extract a numeric Facebook page id from various URL formats the
 * user might paste. Returns { pageId | pageUrl } depending on what was found.
 */
function parseAdvertiserInput(input) {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  // Direct numeric id
  if (/^\d{6,}$/.test(trimmed)) return { pageId: trimmed }
  // Ad library URL with view_all_page_id
  const m = trimmed.match(/view_all_page_id=(\d+)/)
  if (m) return { pageId: m[1] }
  // Plain facebook page URL — use as-is, the actor accepts it
  if (/facebook\.com\/ads\/library/i.test(trimmed)) return { pageUrl: trimmed }
  // Just a brand name — we can't resolve to a page id without an extra lookup,
  // so we hint the user to paste a URL or numeric id.
  return null
}

function ScalingBadge({ days }) {
  if (days == null) return null
  if (days >= 30) return <span className="rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5">Scaling · {days}d</span>
  if (days >= 7)  return <span className="rounded-full bg-amber-100  text-amber-700  text-[10px] font-bold px-2 py-0.5">Steady · {days}d</span>
  return                <span className="rounded-full bg-slate-100  text-slate-700  text-[10px] font-bold px-2 py-0.5">Testing · {days}d</span>
}

function AdCard({ ad }) {
  const [copied, setCopied] = useState(false)
  const thumb = ad.image_url || (ad.video_url ? null : null)
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600 shrink-0">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold truncate">{ad.page_name}</span>
            <ScalingBadge days={ad.days_running} />
          </div>
          <div className="text-[11px] text-[#64756f]">
            {ad.is_active ? 'Active' : 'Inactive'} · Started {ad.start_date ? new Date(ad.start_date).toLocaleDateString() : '—'}
          </div>
        </div>
      </div>
      {thumb && (
        <img src={thumb} alt={ad.title || ''} className="w-full max-h-48 object-cover rounded-xl bg-slate-100"
          onError={(e) => { e.target.style.display = 'none' }} />
      )}
      {ad.title && <div className="text-sm font-bold">{ad.title}</div>}
      {ad.body_text && <p className="text-[13px] text-slate-700 leading-relaxed">{ad.body_text.slice(0, 280)}{ad.body_text.length > 280 ? '…' : ''}</p>}
      <div className="flex items-center gap-2 mt-auto pt-2">
        {ad.cta && <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{ad.cta}</span>}
        {ad.link_url && (
          <a href={ad.link_url} target="_blank" rel="noopener noreferrer"
             className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 flex items-center gap-1 hover:bg-slate-200">
            Landing <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          onClick={() => {
            const txt = `${ad.title || ''}\n\n${ad.body_text || ''}\n\nCTA: ${ad.cta || ''}`.trim()
            navigator.clipboard?.writeText(txt).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            })
          }}
          className="ml-auto flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
        >
          <Copy className="h-3 w-3" />
          {copied ? 'Copied' : 'Copy script'}
        </button>
      </div>
    </div>
  )
}

export default function AdLabPane({ timeRange }) {
  const [input, setInput] = useState('')
  const [activeKey, setActiveKey] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runSearch = async (rawInput) => {
    const parsed = parseAdvertiserInput(rawInput)
    if (!parsed) {
      setError('Paste a Meta Ad Library URL or numeric page ID. Example: https://www.facebook.com/ads/library/?view_all_page_id=15087023444')
      return
    }
    const key = parsed.pageId || parsed.pageUrl
    setActiveKey(key)
    setError(null)
    setLoading(true)
    const cached = loadCache(key)
    if (cached) {
      setData(cached)
      setLoading(false)
    }
    try {
      const result = await fetchAdLibrary({ ...parsed, country: 'US', limit: 25 }, {
        onUpdate: (fresh) => {
          if (fresh && fresh.ok !== false) {
            setData(fresh)
            saveCache(key, fresh)
          }
        },
      })
      if (result) {
        // result here might be top-level items (if SWR cached) or the full object
        setData(result.ok === undefined ? { ok: true, ads: result } : result)
        saveCache(key, result)
      }
    } catch (err) {
      setError(err.message || 'Couldn\'t fetch ad library')
    } finally {
      setLoading(false)
    }
  }

  const ads = (data?.ads || []).filter((a) => a && a.ad_id)
  const scaling = ads.filter((a) => (a.days_running || 0) >= 30)
  const steady = ads.filter((a) => (a.days_running || 0) >= 7 && (a.days_running || 0) < 30)

  return (
    <>
      <PaneHeader
        title="Ad Lab"
        subtitle="Meta Ad Library longevity — see which competitor ads are actually scaling"
      />

      <div className="rounded-3xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] mb-4">
        <div className="text-xs font-bold uppercase tracking-wider text-[#64756f] mb-2">Track an advertiser</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(input)}
            placeholder="Meta Ad Library URL or numeric page ID (e.g. 15087023444 for Nike)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 text-sm font-medium border border-slate-200 focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={() => runSearch(input)}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-5 text-sm flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#64756f]">
          Tip: Open <a className="text-amber-600 underline" href="https://www.facebook.com/ads/library/" target="_blank" rel="noopener noreferrer">facebook.com/ads/library</a>, search for a brand, copy the URL.
        </p>
      </div>

      {error && (
        <div className="rounded-3xl bg-red-50 border border-red-200 p-6 text-center mb-4">
          <AlertCircle className="mx-auto h-8 w-8 text-red-400 mb-2" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {loading && ads.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="rounded-3xl bg-white p-12 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <Megaphone className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">Search to begin</h3>
          <p className="mt-1 text-sm text-[#64756f]">Enter an advertiser's Meta Ad Library URL or page ID above to see their active ads ranked by longevity.</p>
        </div>
      )}

      {ads.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Scaling (30+ days)</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">{scaling.length}</div>
              <div className="text-[11px] text-[#64756f] mt-1">Ads still live after a month - likely profitable</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Steady (7-30 days)</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1">{steady.length}</div>
              <div className="text-[11px] text-[#64756f] mt-1">Past the burn-out window - watch these</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Total fetched</div>
              <div className="text-2xl font-extrabold text-slate-700 mt-1">{ads.length}</div>
              <div className="text-[11px] text-[#64756f] mt-1">For {data?.page_name || 'this advertiser'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ads.slice(0, 24).map((ad) => <AdCard key={ad.ad_id} ad={ad} />)}
          </div>
        </>
      )}
    </>
  )
}
