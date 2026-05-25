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

import React, { useState, useEffect, useCallback } from 'react'
import {
  Megaphone, Search, Calendar, TrendingUp, ExternalLink,
  AlertCircle, Loader2, Copy, Sparkles, Wand2, BookmarkPlus,
  ArrowRight, BarChart3, CheckCircle2,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fetchAdLibrary, fetchGenerateSlides } from '../../../lib/apify'
import { extractBrand } from '../../../lib/brandExtract'
import GeneratedSlidesPanel from '../shared/GeneratedSlidesPanel'

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

// ─── Hook classifier (inlined from contentDeconstruct for bundle compat) ──
const HOOK_PATTERNS = [
  { id: 'contrarian', label: 'Contrarian', re: /^(everything|everyone|most people|nobody|stop believing)/i },
  { id: 'curiosity_gap', label: 'Curiosity Gap', re: /^(i (just )?discovered|the secret|what nobody|here's what|the truth)/i },
  { id: 'direct_challenge', label: 'Direct Challenge', re: /^(you're doing|stop doing|don't|never|quit|if you're still)/i },
  { id: 'question_hook', label: 'Question Hook', re: /^(what if|why (do|does|is|are)|how (do|does|did|can)|when was)/i },
  { id: 'social_proof', label: 'Social Proof', re: /^(after (working|helping)|in my \d+ years|i've (worked|helped))/i },
  { id: 'truth_bomb', label: 'Truth Bomb', re: /^(most people will never|if your .+ isn't|here's the .+ truth)/i },
]
function classifyHook(text) {
  if (!text) return { id: 'plain', label: 'Plain Statement' }
  const first = text.split(/\n|\.\s/)[0].trim()
  for (const h of HOOK_PATTERNS) { if (h.re.test(first)) return h }
  return { id: 'plain', label: 'Plain Statement' }
}
function detectBodyType(text) {
  if (!text) return 'prose'
  if (/^\s*[•\-\*]\s/m.test(text)) return 'bullets'
  if (/^\s*\d+[.)]\s/m.test(text)) return 'numbered'
  return 'prose'
}
function detectEnding(text) {
  if (!text) return 'plain'
  if (/\?\s*(#|$)/.test(text.trim())) return 'question'
  if (/(comment|share|tag|tell me|follow|save)\b/i.test(text.slice(-200))) return 'cta'
  return 'plain'
}
const HOOK_COLORS = {
  plain: 'bg-slate-100 text-slate-600', contrarian: 'bg-amber-50 text-amber-700',
  direct_challenge: 'bg-rose-50 text-rose-700', curiosity_gap: 'bg-violet-50 text-violet-700',
  question_hook: 'bg-sky-50 text-sky-700', social_proof: 'bg-emerald-50 text-emerald-700',
  truth_bomb: 'bg-orange-50 text-orange-700',
}

function AdCard({ ad, onReplicate }) {
  const [copied, setCopied] = useState(false)
  const [analysed, setAnalysed] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)
  const thumb = ad.image_url || null
  const hook = classifyHook(ad.body_text || ad.title)
  const bodyType = detectBodyType(ad.body_text)
  const ending = detectEnding(ad.body_text)

  const handleSaveTemplate = () => {
    try {
      const key = `template:ad:${ad.ad_id}`
      localStorage.setItem(key, JSON.stringify({
        t: Date.now(), source: 'ad', source_id: ad.ad_id, source_page: ad.page_name,
        skeleton: { format: 'carousel', hook_type: hook.id, body_structure: bodyType, ending_type: ending, caption_length_target: (ad.body_text || '').length },
        reference_text: ad.body_text || ad.title || '',
      }))
      setTemplateSaved(true)
      setTimeout(() => setTemplateSaved(false), 2000)
    } catch {}
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] flex flex-col gap-3">
      {/* Header */}
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
      {ad.body_text && <p className="text-[13px] text-slate-700 leading-relaxed">{ad.body_text.slice(0, 280)}{ad.body_text.length > 280 ? '...' : ''}</p>}

      {/* Analysis badges (always visible — zero tokens, instant) */}
      <div className="flex flex-wrap gap-1.5">
        <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', HOOK_COLORS[hook.id] || HOOK_COLORS.plain)}>
          {hook.label}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{bodyType}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{ending}</span>
        {ad.days_running >= 30 && (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Likely profitable</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
        <button onClick={handleSaveTemplate}
          className={cn('flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
            templateSaved ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
          {templateSaved ? <CheckCircle2 className="h-3 w-3" /> : <BookmarkPlus className="h-3 w-3" />}
          {templateSaved ? 'Saved' : 'Save Template'}
        </button>
        <button onClick={() => onReplicate?.(ad, { hook, bodyType, ending })}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-teal-600 px-3 py-1.5 text-[10px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.4)] hover:scale-[1.02] transition-all">
          <Wand2 className="h-3 w-3" /> Replicate with my brand
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(`${ad.title || ''}\n\n${ad.body_text || ''}\n\nCTA: ${ad.cta || ''}`.trim()); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="ml-auto flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100">
          <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
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
  // Generation panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelSlides, setPanelSlides] = useState([])
  const [panelGenerating, setPanelGenerating] = useState(false)
  const [panelTemplateName, setPanelTemplateName] = useState('')
  const [panelBrandCtx, setPanelBrandCtx] = useState(null)

  const handleReplicate = useCallback(async (ad, analysis) => {
    setPanelTemplateName(`${ad.page_name} ad replica`)
    setPanelOpen(true)
    setPanelSlides([])
    setPanelGenerating(true)

    // Build slide prompts from the ad's structure
    const slideCount = 8
    const bgColor = '#0f172a'
    const accentColor = '#14b8a6'
    const hookText = ad.title || ad.body_text?.split('\n')[0] || 'Compelling hook'
    const bodyText = ad.body_text || ''
    const bodyLines = bodyText.split(/\n+/).filter(l => l.trim()).slice(0, 5)

    const prompts = [
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Large bold white text: "${hookText}". Teal accent (${accentColor}). Clean, minimal, bold sans-serif. No images.`,
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). White text: "Here's what makes this work" with teal underline. Minimal typography.`,
      ...bodyLines.slice(0, 4).map((line, i) =>
        `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Number "0${i+1}" in teal (${accentColor}). Bold white text: "${line.slice(0, 120)}". Clean typography.`
      ),
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Bold white text: "${ad.cta || 'Take action today'}". Teal arrow. "Save this for later" in small text.`,
    ].slice(0, slideCount)

    // Initialize placeholder slides
    setPanelSlides(prompts.map((p, i) => ({ index: i, url: null, prompt: p })))

    try {
      const result = await fetchGenerateSlides(prompts, { aspectRatio: '4:5', quality: 'medium' })
      if (result?.slides) setPanelSlides(result.slides)
    } catch (err) {
      console.warn('Slide generation failed:', err.message)
    } finally {
      setPanelGenerating(false)
    }
  }, [])
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
            {ads.slice(0, 24).map((ad) => <AdCard key={ad.ad_id} ad={ad} onReplicate={handleReplicate} />)}
          </div>
        </>
      )}

      {/* Generated slides floating panel */}
      <GeneratedSlidesPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        slides={panelSlides}
        generating={panelGenerating}
        templateName={panelTemplateName}
        brandContext={panelBrandCtx}
      />
    </>
  )
}
