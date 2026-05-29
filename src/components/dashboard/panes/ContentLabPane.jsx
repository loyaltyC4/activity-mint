/**
 * Content Lab — Content Intelligence Pane.
 *
 * Displays the output of the Content Deconstruction Engine:
 *   - Format distribution (photo / reel / carousel split)
 *   - Hook formula distribution (which hooks this account uses)
 *   - Top performers with their template skeletons + framework citations
 *   - Research-backed opportunities (gaps the user should exploit)
 *   - "Save as template" on every deconstructed post
 *
 * Design: Chris Do typography-forward aesthetic — bold DM Sans headings,
 * high contrast, restrained teal+slate palette, grid-based card layouts.
 * Data is the hero, not decoration.
 *
 * Data source: fetchDeconstructProfile() → api/apify-proxy?action=deconstruct_profile
 */

'use strict'

import SectionCard from '../shared/SectionCard'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  LayoutGrid, BarChart3, Sparkles, AlertTriangle, ArrowRight,
  Video, Image as ImageIcon, Layers, Copy, BookmarkPlus,
  RefreshCw, Loader2, CheckCircle2, ChevronDown, ExternalLink,
  Zap, TrendingUp, MessageSquare, Hash,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTrackedAccount } from '../../../context/TrackedAccountContext'
import { supabase } from '../../../lib/supabase'
import { fetchDeconstructProfile, fetchAIInsights, fetchGenerateSlides } from '../../../lib/apify'
import { proxyImg } from '../shared/utils'
import GeneratedSlidesPanel from '../shared/GeneratedSlidesPanel'

// ─── Cache layer ──────────────────────────────────────────────────────────
const CACHE_KEY = (h) => `content_lab:v2:${h}`
const CACHE_TTL = 4 * 60 * 60 * 1000
function loadCache(h) {
  if (!h || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY(h))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || (Date.now() - (d.t || 0)) > CACHE_TTL) return null
    return d.payload
  } catch { return null }
}
function saveCache(h, payload) {
  if (!h || typeof localStorage === 'undefined') return
  try { localStorage.setItem(CACHE_KEY(h), JSON.stringify({ t: Date.now(), payload })) } catch {}
}

// ─── Design tokens (Chris Do aesthetic) ───────────────────────────────────
const SECTION_TITLE = 'font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3'
const CARD = 'rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-5'
const METRIC_BIG = 'font-display font-bold text-3xl tracking-tight leading-none tabular-nums'
const METRIC_LABEL = 'text-[11px] font-medium text-slate-500 mt-1'

const FORMAT_META = {
  carousel: { Icon: Layers, color: 'text-violet-600 bg-violet-50', label: 'Carousel', barColor: 'bg-violet-500' },
  reel:     { Icon: Video,  color: 'text-rose-600 bg-rose-50',     label: 'Reel',     barColor: 'bg-rose-500' },
  photo:    { Icon: ImageIcon, color: 'text-sky-600 bg-sky-50',    label: 'Photo',    barColor: 'bg-sky-400' },
}

const HOOK_COLORS = {
  plain: 'bg-slate-100 text-slate-700',
  contrarian: 'bg-amber-50 text-amber-700',
  direct_challenge: 'bg-rose-50 text-rose-700',
  curiosity_gap: 'bg-violet-50 text-violet-700',
  social_proof: 'bg-emerald-50 text-emerald-700',
  question_hook: 'bg-sky-50 text-sky-700',
  truth_bomb: 'bg-orange-50 text-orange-700',
  result_hook: 'bg-teal-50 text-teal-700',
  visual_interrupt: 'bg-fuchsia-50 text-fuchsia-700',
  wait_what: 'bg-indigo-50 text-indigo-700',
  mid_action: 'bg-cyan-50 text-cyan-700',
}

// ─── Components ───────────────────────────────────────────────────────────

function PaneHeader({ title, subtitle, stale, onRefresh }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div>
        <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">{title}</h1>
        <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>
      </div>
      {(stale || onRefresh) && (
        <div className="flex items-center gap-2">
          {stale && <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600">Analysing...</span>}
          {onRefresh && (
            <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-500 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] hover:bg-slate-50">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, sublabel, index = 0 }) {
  return (
    <div className={`${CARD} animate-in fade-in slide-in-from-bottom-2 fill-mode-both`}
      style={{ animationDelay: `${index * 50}ms`, animationDuration: '350ms' }}>
      <div className={METRIC_BIG}>{value}</div>
      <div className={METRIC_LABEL}>{label}</div>
      {sublabel && <div className="text-[10px] text-slate-400 mt-0.5">{sublabel}</div>}
    </div>
  )
}

function FormatDistribution({ distribution, total }) {
  if (!distribution) return null
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a)
  const maxCount = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <div className={CARD}>
      <div className={SECTION_TITLE}>Format Distribution</div>
      <div className="space-y-3">
        {entries.map(([format, count]) => {
          const meta = FORMAT_META[format] || FORMAT_META.photo
          const pct = total ? Math.round((count / total) * 100) : 0
          return (
            <div key={format} className="flex items-center gap-3">
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${meta.color}`}>
                <meta.Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-bold">{meta.label}</span>
                  <span className="text-[12px] font-bold text-slate-700">{count} <span className="font-normal text-slate-400">({pct}%)</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${meta.barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HookDistribution({ distribution, total }) {
  if (!distribution) return null
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a)
  return (
    <div className={CARD}>
      <div className={SECTION_TITLE}>Hook Formula Usage</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([hookId, count]) => {
          const pct = total ? Math.round((count / total) * 100) : 0
          const colorCls = HOOK_COLORS[hookId] || HOOK_COLORS.plain
          const label = hookId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          return (
            <div key={hookId} className={`rounded-lg px-3 py-2 ${colorCls}`}>
              <div className="text-[12px] font-bold">{label}</div>
              <div className="text-[10px] opacity-70">{count} posts ({pct}%)</div>
            </div>
          )
        })}
      </div>
      {entries.length === 1 && entries[0][0] === 'plain' && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-800">
          <strong>Opportunity:</strong> 100% plain hooks. Try Contrarian ("Everything you know about X is wrong") or Direct Challenge ("You're doing X wrong") for 2-3x reach.
          <div className="mt-1 text-[10px] text-amber-600">Source: Go-Viral.app Feb 2026, 7 proven hook formulas</div>
        </div>
      )}
    </div>
  )
}

function AIInsightsCard({ data }) {
  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(false)
  if (!data?.ok) return null
  return (
    <div className={`${CARD} mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className={SECTION_TITLE}>AI Analysis</div>
        </div>
        <button
          disabled={loading || !!insights}
          onClick={async () => {
            setLoading(true)
            try {
              const result = await fetchAIInsights({
                request_type: 'insights',
                analysis: { patterns: data.patterns, opportunities: data.opportunities },
                posts: data.top_performers?.slice(0, 5)?.map(t => ({
                  type: t.format, likes: t.performance?.likes, comments: t.performance?.comments,
                  caption: t.caption?.full_text?.slice(0, 150),
                })),
              })
              if (result?.insights) setInsights(result.insights)
            } catch (err) { console.warn('AI insights failed:', err.message) }
            finally { setLoading(false) }
          }}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.5)] hover:scale-[1.02] transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {insights ? 'Done' : loading ? 'Thinking...' : 'Get AI Insights'}
        </button>
      </div>
      {insights && (
        <ul className="space-y-2">
          {insights.map((ins, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-violet-50/50 p-3 text-[13px] text-slate-800 leading-relaxed">
              <span className="text-violet-500 font-bold mt-0.5">{'>'}</span>
              <span>{ins}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TopPerformersHero({ performers, onUseTemplate, onGenerateLike }) {
  if (!performers || performers.length === 0) return null
  const top2 = performers.slice(0, 2)
  return (
    <div className="mb-5">
      <div className={SECTION_TITLE}>What's working best</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {top2.map((t, i) => {
          const perf = t.performance || {}
          const hook = t.caption?.hook || { id: 'plain', label: 'Plain' }
          const meta = FORMAT_META[t.format] || FORMAT_META.photo
          const displayUrl = t.source_shortcode
            ? `/api/proxy-image?url=${encodeURIComponent(t.caption?.full_text ? '' : '')}`
            : null
          const templateSaved = useState(false)
          return (
            <div key={t.source_shortcode || i}
              className={`${CARD} border-l-[3px] ${i === 0 ? 'border-l-teal-500' : 'border-l-violet-400'}`}>
              {/* Rank + format */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${meta.color} text-[14px] font-extrabold`}>
                    #{i + 1}
                  </span>
                  <div>
                    <div className="text-[13px] font-bold">{meta.label} — {perf.performance_grade || 'strong'}</div>
                    <div className="text-[11px] text-slate-500">{perf.engagement_rate?.toFixed(3)}% ER · {perf.likes?.toLocaleString()} likes</div>
                  </div>
                </div>
                {t.source_url && (
                  <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* Caption preview */}
              <div className="rounded-lg bg-slate-50 p-3 mb-3">
                <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-3">
                  {t.caption?.full_text?.slice(0, 180)}{(t.caption?.full_text?.length || 0) > 180 ? '...' : ''}
                </p>
              </div>

              {/* Why it works — badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${HOOK_COLORS[hook.id] || HOOK_COLORS.plain}`}>
                  {hook.label}
                </span>
                {t.slide_count && (
                  <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                    {t.slide_count} slides
                  </span>
                )}
                {t.caption?.structure?.has_swipe_cta && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Has swipe CTA
                  </span>
                )}
              </div>

              {/* Citations */}
              {t.citations?.slice(0, 2).map((c, ci) => (
                <div key={ci} className={`text-[10px] mb-1 ${c.signal === 'positive' ? 'text-emerald-600' : c.signal === 'opportunity' ? 'text-amber-600' : 'text-slate-500'}`}>
                  {c.signal === 'positive' ? '+' : c.signal === 'opportunity' ? '!' : '-'} {c.text}
                </div>
              ))}

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => onUseTemplate?.(t)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800">
                  <BookmarkPlus className="h-3 w-3" /> Use as template
                </button>
                <button onClick={() => onGenerateLike?.(t)}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:scale-[1.02] transition-all shadow-[0_4px_12px_-4px_rgba(124,58,237,0.4)]">
                  <Sparkles className="h-3 w-3" /> Generate like this
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OpportunityCard({ opportunity }) {
  const impactColor = opportunity.impact === 'high' ? 'bg-rose-500' : opportunity.impact === 'medium' ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-amber-50/60 to-white p-4 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]">
      <div className="mt-0.5">
        <Zap className="h-4 w-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${impactColor}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{opportunity.impact} impact</span>
        </div>
        <p className="text-[13px] font-medium text-slate-900 leading-relaxed">{opportunity.text}</p>
        <p className="mt-1 text-[10px] text-slate-500">Source: {opportunity.source}</p>
      </div>
    </div>
  )
}

function TopPerformerCard({ template, rank, onSave }) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(false)
  if (!template) return null
  const perf = template.performance || {}
  const hook = template.caption?.hook || { id: 'plain', label: 'Plain' }
  const structure = template.caption?.structure || {}
  const meta = FORMAT_META[template.format] || FORMAT_META.photo
  const citations = template.citations || []

  return (
    <div className={`${CARD} border-l-[3px] ${rank === 0 ? 'border-l-teal-500' : rank === 1 ? 'border-l-slate-400' : 'border-l-slate-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${meta.color} text-[12px] font-extrabold`}>
            #{rank + 1}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold">{meta.label}</span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                perf.performance_grade === 'exceptional' ? 'bg-teal-50 text-teal-700' :
                perf.performance_grade === 'strong' ? 'bg-emerald-50 text-emerald-700' :
                'bg-slate-100 text-slate-600'
              }`}>{perf.performance_grade || 'ungraded'}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {perf.engagement_rate?.toFixed(3)}% ER · {perf.likes?.toLocaleString()} likes · {perf.comments?.toLocaleString()} comments
            </div>
          </div>
        </div>
        {template.source_url && (
          <a href={template.source_url} target="_blank" rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-600"><ExternalLink className="h-3.5 w-3.5" /></a>
        )}
      </div>

      {/* Caption preview */}
      <div className="rounded-lg bg-slate-50 p-3 mb-3">
        <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-3">
          {template.caption?.full_text?.slice(0, 200)}{template.caption?.full_text?.length > 200 ? '...' : ''}
        </p>
      </div>

      {/* Quick stats row */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${HOOK_COLORS[hook.id] || HOOK_COLORS.plain}`}>
          {hook.label || 'Plain'}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
          {structure.body_type || 'prose'}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
          {structure.word_count || 0} words
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
          {template.caption?.hashtag_count || 0} hashtags
        </span>
        {template.slide_count && (
          <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
            {template.slide_count} slides
          </span>
        )}
      </div>

      {/* Expand / collapse details */}
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-500 mb-2">
        {expanded ? 'Hide' : 'Show'} framework analysis
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Chris Do 5-Pillar */}
          {template.frameworks?.chris_do_5_pillar && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Chris Do 5-Pillar Score</div>
              <div className="flex gap-3">
                {['hook', 'clarity', 'fulfillment'].map((pillar) => {
                  const score = template.frameworks.chris_do_5_pillar[pillar]
                  return score != null ? (
                    <div key={pillar} className="text-center">
                      <div className="text-[16px] font-extrabold">{score}<span className="text-[11px] font-normal text-slate-400">/20</span></div>
                      <div className="text-[9px] text-slate-500 capitalize">{pillar}</div>
                    </div>
                  ) : null
                })}
              </div>
              <div className="mt-1 text-[9px] text-slate-400">Source: The Futur / Chris Do</div>
            </div>
          )}

          {/* Hormozi HRR */}
          {template.frameworks?.hormozi_hrr && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Hormozi Hook-Retain-Reward</div>
              <div className="text-[12px] text-slate-700">
                <strong>Hook:</strong> {template.frameworks.hormozi_hrr.hook?.slice(0, 60) || 'n/a'} ·
                <strong> Retain:</strong> {template.frameworks.hormozi_hrr.retain} ·
                <strong> Reward:</strong> {template.frameworks.hormozi_hrr.reward}
              </div>
              <div className="mt-1 text-[9px] text-slate-400">Source: $100M Leads, Alex Hormozi</div>
            </div>
          )}

          {/* Citations */}
          {citations.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Research Notes</div>
              {citations.map((c, i) => (
                <div key={i} className={`flex items-start gap-2 text-[11px] ${
                  c.signal === 'positive' ? 'text-emerald-700' :
                  c.signal === 'opportunity' ? 'text-amber-700' :
                  'text-slate-600'
                }`}>
                  <span>{c.signal === 'positive' ? '✓' : c.signal === 'opportunity' ? '◆' : '·'}</span>
                  <span>{c.text} <span className="text-slate-400">— {c.source}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => {
            // Save template skeleton to localStorage for now
            const key = `template:${template.source_shortcode}`
            try {
              localStorage.setItem(key, JSON.stringify({
                t: Date.now(),
                skeleton: template.template_skeleton,
                source: template.source_shortcode,
                source_username: template.source_username,
                frameworks: template.frameworks,
                citations: template.citations,
              }))
            } catch {}
            setSaved(true)
            if (onSave) onSave(template)
            setTimeout(() => setSaved(false), 2000)
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            saved ? 'bg-teal-50 text-teal-700' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {saved ? <CheckCircle2 className="h-3 w-3" /> : <BookmarkPlus className="h-3 w-3" />}
          {saved ? 'Saved' : 'Save as template'}
        </button>
        <button
          onClick={() => {
            const txt = [
              `Format: ${template.format}`,
              `Hook: ${hook.label} — "${hook.matched_text || ''}"`,
              `Body: ${structure.body_type}`,
              `Ending: ${structure.ending_type}`,
              `Caption length: ${structure.length} chars`,
              template.slide_count ? `Slides: ${template.slide_count}` : null,
              `Hashtags: ${template.caption?.hashtag_count}`,
              `\nTemplate: ${hook.template || 'n/a'}`,
            ].filter(Boolean).join('\n')
            navigator.clipboard?.writeText(txt)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] hover:bg-slate-50"
        >
          <Copy className="h-3 w-3" /> Copy skeleton
        </button>
      </div>
    </div>
  )
}

// ─── Main pane ────────────────────────────────────────────────────────────

export default function ContentLabPane({ timeRange }) {
  const { user } = useAuth()
  const { handle } = useTrackedAccount()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)


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
        onUpdate: (fresh) => {
          if (fresh) { setData(fresh); saveCache(h, fresh) }
        },
      })
      if (result) { setData(result); saveCache(h, result) }
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  const patterns = data?.patterns || {}
  const formatDist = patterns.format_distribution || {}
  const hookDist = patterns.hook_distribution || {}
  const topPerformers = data?.top_performers || []
  const opportunities = data?.opportunities || []
  const postsCount = data?.posts_count || 0
  const avgER = patterns.avg_engagement_rate || 0
  const mixedMedia = patterns.mixed_media_usage || 0

  // Generation panel state
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelSlides, setPanelSlides] = useState([])
  const [panelGenerating, setPanelGenerating] = useState(false)
  const [panelName, setPanelName] = useState('')

  const handleUseTemplate = useCallback((template) => {
    try {
      const key = `template:post:${template.source_shortcode}`
      localStorage.setItem(key, JSON.stringify({
        t: Date.now(), source: 'post', source_shortcode: template.source_shortcode,
        source_username: template.source_username,
        skeleton: template.template_skeleton, frameworks: template.frameworks,
        citations: template.citations,
      }))
    } catch {}
    alert('Template saved! Find it in Template Studio.')
  }, [])

  const handleGenerateLike = useCallback(async (template) => {
    const sk = template.template_skeleton || {}
    const hookText = template.caption?.hook?.matched_text || template.caption?.full_text?.slice(0, 80) || 'Compelling hook'
    const bgColor = '#0f172a'
    const accent = '#14b8a6'
    const prompts = [
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Large bold white text: "${hookText}". Teal accent (${accent}). Minimal.`,
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). White text: "Here's what makes this work" with teal underline.`,
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Number "01" in teal. Bold white insight text. Clean typography.`,
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Number "02" in teal. Bold white insight text. Clean typography.`,
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Number "03" in teal. Bold white insight text. Clean typography.`,
      `Instagram carousel slide, 1080x1350, dark background (${bgColor}). Bold white text: "Follow for more". Teal arrow. CTA slide.`,
    ]
    setPanelName(`Replicate @${template.source_username || handle}`)
    setPanelSlides(prompts.map((p, i) => ({ index: i, url: null, prompt: p })))
    setPanelOpen(true)
    setPanelGenerating(true)
    try {
      const result = await fetchGenerateSlides(prompts, { aspectRatio: '4:5' })
      if (result?.slides) setPanelSlides(result.slides)
    } catch {} finally { setPanelGenerating(false) }
  }, [handle])

  if (!handle && !loading) {
    return (
      <>
        <PaneHeader title="Content Lab" subtitle="Content intelligence powered by research" />
        <div className={`${CARD} text-center py-12`}>
          <LayoutGrid className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold">Track an account first</h3>
          <p className="mt-1 text-sm text-slate-500">Add an Instagram handle to see content intelligence.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <PaneHeader
        title="Content Lab"
        subtitle={data?.ok ? `${postsCount} posts deconstructed for @${handle}` : `Analysing @${handle}`}
        stale={loading}
        onRefresh={() => hydrate(handle, { force: true })}
      />

      {error && (
        <div className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-8 text-center mb-4">
          <LayoutGrid className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            {/no.?posts|insufficient|not found|empty|private/i.test(error)
              ? 'Not enough posts to analyse'
              : 'Content Lab needs more data'}
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Content Lab deconstructs your recent posts into reproducible templates with framework citations. This account needs at least 10 public posts for meaningful analysis.
          </p>
          <button
            onClick={() => hydrate(handle, { force: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-200"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      )}

      {/* Show friendly empty state when data returned ok:false (not enough posts) */}
      {!data?.ok && !loading && !error && (
        <div className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-pane p-8 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            {data?.reason === 'insufficient-posts' || data?.posts_count === 0
              ? 'Not enough posts to analyse'
              : 'Loading content intelligence'}
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            {data?.reason
              ? 'Content Lab needs at least 3 public posts to deconstruct. Try tracking an account with more content like @natgeotravel or @moretolife.au.'
              : 'Content Lab will populate once your posts are analysed. This can take 10-30 seconds on the first load.'}
          </p>
          <button onClick={() => hydrate(handle, { force: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-200">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Stat tiles — only show when we have real data */}
      {(data?.ok || loading) && <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : (
          <>
            <StatTile index={0} value={postsCount} label="Posts analysed" sublabel="via Apify post-scraper" />
            <StatTile index={1} value={`${avgER.toFixed(3)}%`} label="Avg engagement rate"
              sublabel={avgER > 0 ? `${data?.followers ? (avgER >= 0.8 ? 'Above' : 'Below') + ' tier avg' : ''}` : null} />
            <StatTile index={2} value={`${Math.round(mixedMedia * 100)}%`} label="Mixed-media usage"
              sublabel={mixedMedia === 0 ? 'Opportunity: 2.33% ER' : null} />
            <StatTile index={3} value={Object.keys(hookDist).length} label="Hook types used"
              sublabel={Object.keys(hookDist).length <= 1 ? 'Try more variety' : null} />
          </>
        )}
      </div>}

      {/* Distribution charts */}
      {(data?.ok || loading) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {loading && !data ? (
            <>
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </>
          ) : (
            <>
              <FormatDistribution distribution={formatDist} total={postsCount} />
              <HookDistribution distribution={hookDist} total={postsCount} />
            </>
          )}
        </div>
      )}

      {/* Top Performers Hero — the bridge from "what works" to "create something" */}
      {data?.ok && topPerformers.length > 0 && (
        <TopPerformersHero
          performers={topPerformers}
          onUseTemplate={handleUseTemplate}
          onGenerateLike={handleGenerateLike}
        />
      )}

      {/* AI Insights */}
      {data?.ok && <AIInsightsCard data={data} />}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div className="mb-5">
          <div className={SECTION_TITLE}>Research-Backed Opportunities</div>
          <div className="space-y-2">
            {opportunities.map((o, i) => <OpportunityCard key={i} opportunity={o} />)}
          </div>
        </div>
      )}

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <div>
          <div className={SECTION_TITLE}>Top Performers — Deconstructed</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topPerformers.slice(0, 6).map((t, i) => (
              <TopPerformerCard key={t.source_shortcode || i} template={t} rank={i} />
            ))}
          </div>
        </div>
      )}

      {/* Loading fallback for performers */}
      {loading && !data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      )}

      {/* Generated slides panel */}
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
