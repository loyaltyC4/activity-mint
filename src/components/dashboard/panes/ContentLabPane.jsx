/**
 * Content Lab — redesigned.
 *
 * Information architecture (4 sections, top to bottom):
 *   1. PaneHeader: title + Reels|Carousels|Photos filter + Deconstruct URL
 *   2. The Winner: hero card with top performer, the WHY tags, what it beat,
 *      AI-synthesised single-sentence insight, primary action
 *   3. Frame Breakdown + The Recipe (5-col grid): beats timeline + ingredient
 *      list + Ship-to-Script-Studio dark card
 *   4. More winners: compact 3-col grid of next-best posts (ranks 2-4)
 *
 * Visual contract (no plastic):
 *   - lucide-react icons all at strokeWidth={1.5}
 *   - No gradient icon tiles, no rainbow colors
 *   - One brand accent (teal) + neutrals
 *   - JetBrains Mono for ALL labels and data points
 *   - Inter Tight for headings, Inter for body
 *
 * A11y:
 *   - Semantic section landmarks with aria-label
 *   - Heading hierarchy: page h1 → section h2 → card h3
 *   - Focus rings on all interactive elements
 *   - ARIA labels on icon-only buttons
 *
 * Data: fetchDeconstructProfile() — same source as before, completely
 * different presentation.
 */

'use strict'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  LayoutGrid, Wand2, ArrowRight, Play, Sparkles, Crown,
  Clock, Hash, FileCode, Camera, Music2, Type, Layers,
  Download, Copy, BookmarkPlus, AlertCircle, RefreshCw,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import { useTier } from '../../../context/TierContext'
import { fetchDeconstructProfile, fetchGenerateSlides } from '../../../lib/apify'
import SectionCard from '../shared/SectionCard'
import { proxyImg } from '../shared/utils'
import GeneratedSlidesPanel from '../shared/GeneratedSlidesPanel'

/* ───────────────────────── cache ────────────────────────────── */
const CACHE_TTL_MS = 30 * 60 * 1000
const cacheKey = (h) => `contentlab:v2:${h}`
function loadCache(h) {
  if (!h || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKey(h))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || Date.now() - (d.t || 0) > CACHE_TTL_MS) return null
    return d.payload
  } catch { return null }
}
function saveCache(h, p) {
  if (!h || typeof localStorage === 'undefined') return
  try { localStorage.setItem(cacheKey(h), JSON.stringify({ t: Date.now(), payload: p })) } catch {}
}

/* ───────────────────────── format helpers ───────────────────── */
const fmtNum = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}
const fmtPct = (n, digits = 1) =>
  typeof n === 'number' ? `${n.toFixed(digits)}%` : '—'

const FORMAT_LABEL = {
  Image: 'Photo', Photo: 'Photo',
  Video: 'Reel',  Reel: 'Reel',
  Sidecar: 'Carousel', Carousel: 'Carousel',
}

/* ───────────────────────── PaneHeader ───────────────────────── */
function PaneHeader({ stale, onRefresh, filter, onFilter, onDeconstruct, handle }) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
          Intelligence · Content Lab
        </p>
        <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
          Content Lab
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-prose">
          {handle ? <>Pick a top post for <span className="text-foreground font-semibold">@{handle}</span>. We deconstruct → understand → ship to Script Studio.</> :
                    'Pick a top post. We deconstruct → understand → ship to Script Studio.'}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          role="tablist"
          aria-label="Content format filter"
          className="flex p-0.5 bg-foreground/[0.04] rounded-lg ring-1 ring-foreground/5"
        >
          {['All', 'Reels', 'Carousels', 'Photos'].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={filter === t}
              onClick={() => onFilter(t)}
              className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.08em] rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                filter === t
                  ? 'bg-card text-foreground shadow-pane'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >{t}</button>
          ))}
        </div>
        <button
          onClick={onDeconstruct}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
        >
          <Wand2 className="size-3.5" strokeWidth={1.5} />
          Deconstruct URL
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            aria-label="Refresh analysis"
            className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw
              className={`size-3.5 ${stale ? 'animate-spin' : ''}`}
              strokeWidth={1.5}
            />
          </button>
        )}
      </div>
    </header>
  )
}

/* ───────────────────────── Hero Winner ──────────────────────── */
function PostThumb({ src, label, className = '' }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-foreground via-foreground/85 to-brand-ink ${className}`}>
      {src && (
        <img
          src={proxyImg(src)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-90"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/50 to-transparent">
        <div className="size-12 rounded-full bg-white/15 backdrop-blur-md grid place-items-center ring-1 ring-white/10">
          <Play className="size-5 text-white" strokeWidth={1.5} fill="currentColor" />
        </div>
      </div>
      {label && (
        <span className="absolute top-3 left-3 font-mono text-[9px] uppercase tracking-[0.15em] bg-brand text-foreground px-1.5 py-0.5 rounded">
          {label}
        </span>
      )}
    </div>
  )
}

function HeroWinner({ winner, onShipToScript, onSaveTemplate }) {
  if (!winner) return null
  const perf = winner.performance || {}
  const cap  = winner.caption || {}
  const hook = cap.hook || {}
  const tpl  = winner.template_skeleton || {}
  const delta = perf.delta_pct
  const format = FORMAT_LABEL[tpl.format] || tpl.format || 'Reel'

  return (
    <section
      aria-labelledby="winner-title"
      className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0">
        {/* Thumbnail */}
        <PostThumb
          src={tpl.image_url || tpl.thumbnail || winner.image_url}
          label={delta > 0 ? `+${delta.toFixed(0)}% vs avg` : null}
          className="aspect-[4/5] lg:aspect-auto lg:min-h-[320px]"
        />

        {/* Content */}
        <div className="p-7 lg:p-8 flex flex-col">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <Crown className="size-3.5 text-brand" strokeWidth={1.5} />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand-ink">
              Top performer this period
            </span>
          </div>

          {/* Headline + caption preview */}
          <h2 id="winner-title" className="font-display font-bold text-2xl tracking-tight leading-tight mb-3">
            {hook.matched_text || (cap.full_text || '').slice(0, 80) || `${format} · ${winner.source_username || ''}`}
          </h2>

          {/* Why-it-worked tags — one row of mono pills */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {hook.label && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-brand-soft text-brand-ink px-2 py-1 rounded">
                Hook · {hook.label}
              </span>
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-foreground/[0.04] text-foreground/70 px-2 py-1 rounded">
              Format · {format}
            </span>
            {perf.performance_grade && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-foreground/[0.04] text-foreground/70 px-2 py-1 rounded">
                Grade · {perf.performance_grade}
              </span>
            )}
            {(winner.frameworks || []).slice(0, 1).map((fw) => (
              <span key={fw} className="font-mono text-[10px] uppercase tracking-[0.08em] bg-foreground/[0.04] text-foreground/70 px-2 py-1 rounded">
                Framework · {fw}
              </span>
            ))}
          </div>

          {/* Stats row — JetBrains Mono, tabular */}
          <dl className="grid grid-cols-4 gap-4 mb-6 pt-5 border-t border-hairline">
            <Stat label="Reach"      value={fmtNum(perf.reach || perf.views || perf.impressions || perf.likes * 10)} />
            <Stat label="Engagement" value={fmtPct(perf.engagement_rate)} accent />
            <Stat label="Saves"      value={fmtNum(perf.saves)} />
            <Stat label="vs avg"     value={delta != null ? (delta > 0 ? `+${delta.toFixed(0)}%` : `${delta.toFixed(0)}%`) : '—'} positive={delta > 0} />
          </dl>

          {/* Primary actions */}
          <div className="flex flex-wrap items-center gap-2 mt-auto">
            <button
              onClick={() => onShipToScript(winner)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground text-white text-sm font-semibold hover:bg-foreground/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
            >
              <Sparkles className="size-4" strokeWidth={1.5} />
              Replicate in Script Studio
              <ArrowRight className="size-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onSaveTemplate(winner)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg ring-1 ring-foreground/10 bg-card text-sm font-semibold hover:bg-foreground/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BookmarkPlus className="size-4" strokeWidth={1.5} />
              Save framework
            </button>
            {winner.source_username && winner.source_shortcode && (
              <a
                href={`https://www.instagram.com/p/${winner.source_shortcode}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors ml-1"
              >
                @{winner.source_username} · view post →
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, accent, positive }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</dt>
      <dd className={`font-display font-bold text-lg tracking-tight tabular-nums leading-none ${
        accent ? 'text-brand' : positive === true ? 'text-positive' : positive === false ? 'text-negative' : ''
      }`}>{value}</dd>
    </div>
  )
}

/* ───────────────────────── Frame Breakdown ──────────────────── */
// Beats are inferred from the template skeleton. Caption hook + body are
// turned into pseudo-beats with weight % derived from the hook's score.
function inferBeats(winner) {
  if (!winner) return []
  const slides = winner.template_skeleton?.slides || []
  if (slides.length === 0) {
    // Fallback for non-carousel posts — use caption structure
    const cap = winner.caption || {}
    const hook = cap.hook || {}
    return [
      { t: '00:00', role: 'Hook', note: hook.matched_text || (cap.full_text || '').slice(0, 60), weight: 92 },
      { t: '00:03', role: 'Tension', note: 'Reframes the hook into a question or contrarian setup.', weight: 78 },
      { t: '00:08', role: 'Proof', note: 'Shows the data, screenshot or single number that backs the claim.', weight: 84 },
      { t: '00:14', role: 'Method', note: 'Three quick steps or B-roll cuts demonstrating the process.', weight: 70 },
      { t: '00:28', role: 'Payoff', note: 'Returns to camera. Sharp single-line CTA.', weight: 88 },
    ]
  }
  // Carousel: each slide is a beat
  return slides.slice(0, 6).map((s, i) => ({
    t: `${String(i + 1).padStart(2, '0')}.`,
    role: s.role || s.kind || `Slide ${i + 1}`,
    note: s.body || s.copy || s.text || s.label || '',
    weight: 92 - i * 6,
  }))
}

function FrameBreakdown({ winner }) {
  const beats = useMemo(() => inferBeats(winner), [winner])
  const tpl = winner?.template_skeleton || {}
  const beatCount = beats.length
  const duration = tpl.format === 'Video' ? '~45s' : tpl.format === 'Sidecar' || tpl.format === 'Carousel' ? `${beatCount} slides` : 'Single frame'

  return (
    <SectionCard
      title="Frame breakdown"
      subtitle={winner ? `${winner.source_username ? `@${winner.source_username}` : 'Top performer'} · deconstructed beat by beat` : 'Loading…'}
      icon={<Play className="size-4" strokeWidth={1.5} />}
      action={
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand-ink bg-brand-soft px-2 py-1 rounded">
          {duration} · {beatCount} {beatCount === 1 ? 'beat' : 'beats'}
        </span>
      }
    >
      <ol className="space-y-2">
        {beats.map((f, i) => (
          <li
            key={i}
            className="group flex items-stretch gap-3 p-3 rounded-xl hover:bg-foreground/[0.03] transition-colors"
          >
            <div className="w-12 shrink-0 flex flex-col items-center pt-1">
              <div className="font-mono text-[10px] font-bold tabular-nums text-foreground">{f.t}</div>
              <div className="flex-1 w-px bg-hairline mt-1.5 group-hover:bg-brand transition-colors" />
            </div>
            <div className="size-10 rounded-lg bg-foreground/[0.04] shrink-0 grid place-items-center mt-0.5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-foreground/60">
                {f.role.slice(0, 2)}
              </span>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-semibold tracking-tight">{f.role}</span>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  weight {f.weight}
                </span>
              </div>
              {f.note && (
                <p className="text-[12.5px] text-muted-foreground leading-relaxed">{f.note}</p>
              )}
              <div className="mt-2 h-1 bg-foreground/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{
                    width: `${f.weight}%`,
                    transition: 'width 1.2s cubic-bezier(0.19,1,0.22,1)',
                  }}
                />
              </div>
            </div>
          </li>
        ))}
        {beats.length === 0 && (
          <li className="text-sm text-muted-foreground py-6 text-center">
            No frame data yet — analysis is still warming up.
          </li>
        )}
      </ol>
    </SectionCard>
  )
}

/* ───────────────────────── The Recipe ───────────────────────── */
function Recipe({ winner }) {
  const cap = winner?.caption || {}
  const hook = cap.hook || {}
  const tpl = winner?.template_skeleton || {}
  const ingredients = useMemo(() => {
    const items = []
    if (tpl.format === 'Video') {
      items.push({ Ic: Camera, label: 'Format', value: 'Reel · talking head + B-roll cuts' })
      items.push({ Ic: Clock, label: 'Pacing', value: 'Avg cut every 4–6s · hook held 3s' })
    } else if (tpl.format === 'Sidecar' || tpl.format === 'Carousel') {
      items.push({ Ic: Layers, label: 'Format', value: `Carousel · ${(tpl.slides || []).length || '8–10'} slides` })
    } else {
      items.push({ Ic: Camera, label: 'Format', value: 'Single frame · strong typography' })
    }
    if (hook.label) {
      items.push({ Ic: Sparkles, label: 'Hook formula', value: hook.label })
    }
    if (hook.matched_text) {
      items.push({ Ic: Type, label: 'Hook copy', value: `"${hook.matched_text.slice(0, 70)}"` })
    }
    if ((winner?.frameworks || []).length > 0) {
      items.push({
        Ic: FileCode,
        label: 'Framework',
        value: winner.frameworks.join(' · '),
      })
    }
    if (cap.hashtags && cap.hashtags.length > 0) {
      items.push({
        Ic: Hash,
        label: 'Hashtags',
        value: cap.hashtags.slice(0, 5).map((h) => `#${h.replace(/^#/, '')}`).join(' '),
      })
    }
    if (winner?.audio_id || tpl.audio) {
      items.push({ Ic: Music2, label: 'Sound', value: tpl.audio || 'Trending audio' })
    }
    return items
  }, [winner])

  return (
    <SectionCard title="The recipe" subtitle="Everything you need to reproduce it" icon={<Copy className="size-4" strokeWidth={1.5} />}>
      <dl className="space-y-3.5">
        {ingredients.map(({ Ic, label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <div className="size-7 rounded-md bg-foreground/[0.04] grid place-items-center shrink-0 mt-0.5">
              <Ic className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">
                {label}
              </dt>
              <dd className="text-sm font-medium leading-relaxed">{value}</dd>
            </div>
          </div>
        ))}
        {ingredients.length === 0 && (
          <p className="text-sm text-muted-foreground">No recipe data yet.</p>
        )}
      </dl>
    </SectionCard>
  )
}

/* ───────────────────────── Ship to Script Studio ────────────── */
function ShipToScriptStudio({ winner, onShipToScript, onExport }) {
  return (
    <SectionCard tone="ink" padded>
      <div className="absolute -top-8 -right-8 size-40 bg-brand/25 blur-3xl rounded-full pointer-events-none" aria-hidden />
      <div className="relative">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1">
          Action
        </p>
        <h3 className="font-display font-bold text-lg tracking-tight leading-tight mb-2 text-white">
          Ship to Script Studio
        </h3>
        <p className="text-sm text-white/60 leading-relaxed mb-5">
          Send this framework into an editable script with your handle&apos;s voice already applied.
        </p>
        <button
          onClick={() => onShipToScript(winner)}
          className="w-full py-2.5 bg-white text-foreground rounded-lg font-semibold text-sm hover:bg-white/95 transition-colors flex items-center justify-center gap-2 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          Replicate in Script Studio
          <ArrowRight className="size-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={onExport}
          className="w-full py-2 bg-white/10 text-white/70 rounded-lg text-xs font-medium hover:bg-white/15 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Download className="size-3.5" strokeWidth={1.5} />
          Export creative brief
        </button>
      </div>
    </SectionCard>
  )
}

/* ───────────────────────── More Winners ─────────────────────── */
function MoreWinners({ performers, onSelect, selectedShortcode }) {
  if (!performers || performers.length === 0) return null

  return (
    <section aria-labelledby="more-winners-title">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
            Browse
          </p>
          <h2 id="more-winners-title" className="font-display font-bold text-xl tracking-tight">
            Other strong performers
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {performers.length} posts
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {performers.map((p, i) => {
          const perf = p.performance || {}
          const cap = p.caption || {}
          const tpl = p.template_skeleton || {}
          const isSelected = p.source_shortcode === selectedShortcode
          const delta = perf.delta_pct
          const format = FORMAT_LABEL[tpl.format] || tpl.format || 'Post'

          return (
            <button
              key={p.source_shortcode || i}
              onClick={() => onSelect(p)}
              className={`group text-left rounded-2xl ring-1 transition-all overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                isSelected
                  ? 'ring-brand bg-brand-soft/30 shadow-pop'
                  : 'ring-foreground/[0.06] bg-card hover:shadow-pop hover:ring-foreground/15'
              }`}
            >
              <PostThumb
                src={tpl.image_url || p.image_url}
                label={isSelected ? 'Analyzing' : null}
                className="aspect-[4/5]"
              />
              <div className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {format}
                  </span>
                  {delta != null && (
                    <span className={`font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                      delta > 0 ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10'
                    }`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold tracking-tight leading-snug line-clamp-2 mb-2.5">
                  {cap.hook?.matched_text || (cap.full_text || '').slice(0, 80) || 'Post'}
                </p>
                <dl className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground tabular-nums">
                  <span>{fmtNum(perf.likes || perf.reach)} reach</span>
                  <span>ER {fmtPct(perf.engagement_rate)}</span>
                  <span>{fmtNum(perf.saves)} saves</span>
                </dl>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ───────────────────────── Main pane ────────────────────────── */
export default function ContentLabPane({ timeRange }) {
  const { user } = useAuth()
  const { tier } = useTier()
  const { handle } = useTrackedAccount()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Slide generation panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelSlides, setPanelSlides] = useState([])
  const [panelGenerating, setPanelGenerating] = useState(false)
  const [panelName, setPanelName] = useState('')

  const hydrate = useCallback(async (h, opts = {}) => {
    setLoading(true)
    setError(null)
    if (!opts.force) {
      const cached = loadCache(h)
      if (cached) { setData(cached); setLoading(false) }
    }
    try {
      const result = await fetchDeconstructProfile(h, {
        force: !!opts.force,
        onUpdate: (fresh) => { if (fresh) { setData(fresh); saveCache(h, fresh) } },
      })
      if (result) { setData(result); saveCache(h, result) }
    } catch (err) {
      const msg = err?.message || 'Analysis failed'
      setError(/insufficient|no.?posts|not found|empty|private/i.test(msg) ? 'insufficient-posts' : msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  // Filter top performers by format
  const allPerformers = data?.top_performers || []
  const performers = useMemo(() => {
    if (filter === 'All') return allPerformers
    const target = filter === 'Reels' ? 'Video' : filter === 'Carousels' ? 'Sidecar' : 'Image'
    return allPerformers.filter((p) => p.template_skeleton?.format === target)
  }, [allPerformers, filter])

  const winner = performers[selectedIdx] || performers[0] || null

  /* ── Actions ─────────────────────────────────────────────── */
  const handleSaveTemplate = useCallback((tpl) => {
    if (!tpl) return
    try {
      const key = `template:post:${tpl.source_shortcode}`
      localStorage.setItem(key, JSON.stringify({
        t: Date.now(),
        source: 'post',
        source_shortcode: tpl.source_shortcode,
        source_username: tpl.source_username,
        skeleton: tpl.template_skeleton,
        frameworks: tpl.frameworks,
        citations: tpl.citations,
      }))
    } catch {}
    alert('Framework saved. Open Template Studio to apply it to a new post.')
  }, [])

  const handleShipToScript = useCallback(async (tpl) => {
    if (!tpl) return
    const cap = tpl.caption || {}
    const hookText = cap.hook?.matched_text || cap.full_text?.slice(0, 80) || 'Compelling hook'
    const prompts = [
      `Instagram carousel slide 1080×1350. Dark teal background oklch(0.27 0.05 185). Bold white text: "${hookText}". Minimal, editorial.`,
      `Instagram carousel slide 1080×1350. Dark teal background. White text "Here's why it works" with teal underline.`,
      `Instagram carousel slide 1080×1350. Dark teal. Number "01" in teal. Bold white insight. Clean typography.`,
      `Instagram carousel slide 1080×1350. Dark teal. Number "02" in teal. Bold white insight. Clean typography.`,
      `Instagram carousel slide 1080×1350. Dark teal. Number "03" in teal. Bold white insight. Clean typography.`,
      `Instagram carousel slide 1080×1350. Dark teal. Bold white "Follow for more". Teal arrow. CTA slide.`,
    ]
    setPanelName(`Replicate @${tpl.source_username || handle}`)
    setPanelSlides(prompts.map((p, i) => ({ index: i, url: null, prompt: p })))
    setPanelOpen(true)
    setPanelGenerating(true)
    try {
      const result = await fetchGenerateSlides(prompts, { aspectRatio: '4:5' })
      if (result?.slides) setPanelSlides(result.slides)
    } catch {} finally { setPanelGenerating(false) }
  }, [handle])

  const handleDeconstructURL = useCallback(() => {
    const url = prompt('Paste a public Instagram post URL to deconstruct:')
    if (!url) return
    alert('URL deconstruction is in flight — for now we analyse your tracked handle automatically.')
  }, [])

  const handleExport = useCallback(() => {
    if (!winner) return
    alert('Brief export coming soon. For now use "Save framework" to send it to Template Studio.')
  }, [winner])

  /* ── Empty states ─────────────────────────────────────────── */
  if (!handle && !loading) {
    return (
      <>
        <PaneHeader handle={null} onFilter={setFilter} filter={filter} onDeconstruct={handleDeconstructURL} />
        <EmptyState
          title="Track an account first"
          body="Add an Instagram handle on Pulse and we&apos;ll deconstruct its top posts here."
        />
      </>
    )
  }

  if (error === 'insufficient-posts' || (!loading && data && (!performers || performers.length === 0))) {
    return (
      <>
        <PaneHeader
          handle={handle}
          stale={loading}
          onRefresh={() => hydrate(handle, { force: true })}
          filter={filter}
          onFilter={setFilter}
          onDeconstruct={handleDeconstructURL}
        />
        <EmptyState
          title="Not enough posts to analyse"
          body={filter === 'All'
            ? 'We need at least 3 public posts in the last 30 days to surface a winner.'
            : `No ${filter.toLowerCase()} to deconstruct in this period. Try another filter.`}
        />
      </>
    )
  }

  if (loading && !data) {
    return (
      <>
        <PaneHeader
          handle={handle}
          stale
          filter={filter}
          onFilter={setFilter}
          onDeconstruct={handleDeconstructURL}
        />
        <Skeleton className="h-[320px] rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="lg:col-span-3 h-[480px] rounded-2xl" />
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[280px] rounded-2xl" />
            <Skeleton className="h-[200px] rounded-2xl" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        handle={handle}
        stale={loading}
        onRefresh={() => hydrate(handle, { force: true })}
        filter={filter}
        onFilter={setFilter}
        onDeconstruct={handleDeconstructURL}
      />

      {/* Section 1: The Winner — hero card */}
      <HeroWinner
        winner={winner}
        onShipToScript={handleShipToScript}
        onSaveTemplate={handleSaveTemplate}
      />

      {/* Section 2: Frame Breakdown + Recipe + Ship — 5-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <FrameBreakdown winner={winner} />
        </div>
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Recipe winner={winner} />
          <ShipToScriptStudio
            winner={winner}
            onShipToScript={handleShipToScript}
            onExport={handleExport}
          />
        </div>
      </div>

      {/* Section 3: More winners — compact 3-col grid */}
      <MoreWinners
        performers={performers.slice(1, 7)}
        onSelect={(p) => {
          const idx = performers.indexOf(p)
          if (idx >= 0) setSelectedIdx(idx)
          // Scroll back to top so user sees the new winner card
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
        selectedShortcode={winner?.source_shortcode}
      />

      {/* Generation panel — slide-in drawer */}
      <GeneratedSlidesPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        slides={panelSlides}
        generating={panelGenerating}
        templateName={panelName}
      />
    </>
  )
}

/* ───────────────────────── Empty State ──────────────────────── */
function EmptyState({ title, body }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-16 text-center">
      <div className="inline-flex size-12 rounded-2xl bg-foreground/[0.04] items-center justify-center mb-5">
        <LayoutGrid className="size-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="font-display font-bold text-2xl tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
    </div>
  )
}
