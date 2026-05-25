/**
 * Script Studio — the user's own engagement data turned into a mathematical
 * copywriting blueprint.
 *
 * Four cards:
 *   1. Performance Distribution — histogram of Δ_P across 50 posts with
 *      winner/loser bands. Visualises where this account's hits and misses live.
 *   2. Verified Lexicon — two columns (green winners, red losers). The
 *      "link in bio" finding came from this on natgeotravel.
 *   3. Structural Blueprint — common opener / body shape / ending across
 *      winning posts.
 *   4. Steal This Script — three fill-in-the-blank templates generated from
 *      the blueprint, ready to copy.
 */

'use strict'

import React, { useEffect, useState, useCallback } from 'react'
import {
  PenTool, TrendingUp, TrendingDown, Sparkles, Copy, RefreshCw,
  BarChart3, FileText, Loader2, AlertCircle, Lock, Crown, ArrowRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../../../context/AuthContext'
import { useTier } from '../../../context/TierContext'
import { supabase } from '../../../lib/supabase'
import { fetchScriptStudio, fetchAIInsights } from '../../../lib/apify'

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours
const CACHE_KEY = (h) => `script_studio:v1:${h}`

function loadCache(h) {
  if (!h || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY(h))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || (Date.now() - (data.t || 0)) > CACHE_TTL_MS) return null
    return data.payload
  } catch { return null }
}
function saveCache(h, payload) {
  if (!h || typeof localStorage === 'undefined') return
  try { localStorage.setItem(CACHE_KEY(h), JSON.stringify({ t: Date.now(), payload })) } catch {}
}

function PaneHeader({ title, subtitle, stale, onRefresh }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
      </div>
      <div className="flex items-center gap-2">
        {stale && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]">
            Analysing…
          </span>
        )}
        {onRefresh && (
          <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-[8px] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#64756f] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:bg-slate-50">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        )}
      </div>
    </div>
  )
}

function DistributionCard({ distribution, baselines, buckets }) {
  if (!distribution || distribution.length === 0) {
    return <PlaceholderCard title="Performance Distribution" subtitle="Need 10+ recent posts to chart distribution" />
  }
  // Bin Δ_P into a histogram. Buckets: [-1, -0.5, -0.3, 0, 0.3, 0.5, 1, 2+]
  const bins = [
    { label: '<-50%',  min: -Infinity, max: -0.5, color: 'bg-red-400' },
    { label: '-30%',   min: -0.5,      max: -0.3, color: 'bg-red-300' },
    { label: '0',      min: -0.3,      max:  0,   color: 'bg-slate-200' },
    { label: '+0',     min:  0,        max:  0.3, color: 'bg-slate-300' },
    { label: '+30%',   min:  0.3,      max:  0.5, color: 'bg-emerald-300' },
    { label: '+50%',   min:  0.5,      max:  1.0, color: 'bg-emerald-400' },
    { label: '+100%',  min:  1.0,      max:  2.0, color: 'bg-emerald-500' },
    { label: '+200%',  min:  2.0,      max: Infinity, color: 'bg-emerald-600' },
  ]
  const counts = bins.map((b) => distribution.filter((d) => d.delta >= b.min && d.delta < b.max).length)
  const maxCount = Math.max(1, ...counts)

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold">Performance Distribution</div>
          <div className="text-xs text-[#64756f]">{distribution.length} posts · {buckets.winners_n} winners · {buckets.losers_n} losers</div>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-32">
        {bins.map((b, i) => {
          const c = counts[i]
          const h = Math.round((c / maxCount) * 100)
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] font-bold text-[#64756f]">{c || ''}</div>
              <div className={`w-full ${b.color} rounded-t-md transition-all`} style={{ height: `${h}%` }} title={`${b.label}: ${c} posts`}></div>
              <div className="text-[10px] text-[#64756f]">{b.label}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-[#64756f]">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Winners (Δ {'>'} +50%)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>Losers (Δ {'<'} −30%)</span>
        <span className="ml-auto">Baseline median: {Math.round(baselines?.global || 0)} engagement</span>
      </div>
    </div>
  )
}

function LexiconCard({ lexicon }) {
  if (!lexicon) {
    return <PlaceholderCard title="Verified Lexicon" subtitle="Run analysis to see your high-traction phrases" />
  }
  const winners = lexicon.winners || []
  const losers = lexicon.losers || []
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold">Verified Lexicon</div>
          <div className="text-xs text-[#64756f]">Phrases mathematically tied to engagement (log-odds with Dirichlet prior)</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            <TrendingUp className="h-3 w-3" /> High-Traction
          </div>
          <ul className="space-y-1.5">
            {winners.length === 0 && <li className="text-xs text-[#64756f]">No statistically distinctive winner phrases yet — try more recent posts.</li>}
            {winners.map((w, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]">
                <span className="text-sm font-medium text-emerald-900 truncate">"{w.phrase}"</span>
                <span className="text-[10px] text-emerald-700 font-bold whitespace-nowrap ml-2">+{(Math.exp(w.delta) * 100 - 100).toFixed(0)}% lift</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700">
            <TrendingDown className="h-3 w-3" /> Dead Phrases
          </div>
          <ul className="space-y-1.5">
            {losers.length === 0 && <li className="text-xs text-[#64756f]">No clear engagement-killing phrases detected.</li>}
            {losers.map((l, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 shadow-[0_0_0_1px_rgba(239,68,68,0.18)]">
                <span className="text-sm font-medium text-red-900 truncate">"{l.phrase}"</span>
                <span className="text-[10px] text-red-700 font-bold whitespace-nowrap ml-2">{(Math.exp(l.delta) * 100 - 100).toFixed(0)}% drop</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function BlueprintCard({ blueprint }) {
  if (!blueprint || !blueprint.ok) {
    return <PlaceholderCard title="Structural Blueprint" subtitle="Need 5+ winning posts to detect structure" />
  }
  const items = [
    { label: 'Opener', value: blueprint.common_opener?.label, share: blueprint.common_opener?.share },
    { label: 'Ending', value: blueprint.common_ending?.id?.replace(/-/g, ' '), share: blueprint.common_ending?.share },
    { label: 'Bullets', value: blueprint.uses_bullets_share > 0.4 ? 'Yes (high share)' : 'Rarely', share: blueprint.uses_bullets_share },
    { label: 'Avg length', value: `${blueprint.avg_length} chars`, share: null },
  ]
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold">Structural Blueprint</div>
          <div className="text-xs text-[#64756f]">The shape of your highest-performing posts ({blueprint.sample_size} winners analysed)</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl bg-violet-50/40 p-3 shadow-[0_0_0_1px_rgba(124,58,237,0.12)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{it.label}</div>
            <div className="mt-1 text-sm font-bold text-slate-900 truncate">{it.value || '—'}</div>
            {typeof it.share === 'number' && <div className="text-[10px] text-[#64756f]">{Math.round(it.share * 100)}% of winners</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function AIGenerateButton({ analysis, onResult }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  if (!analysis) return null
  return (
    <button
      disabled={loading || done}
      onClick={async () => {
        setLoading(true)
        try {
          const result = await fetchAIInsights({
            request_type: 'scripts',
            analysis: {
              buckets: analysis.buckets,
              lexicon: analysis.lexicon,
              blueprint: analysis.blueprint,
              posts_count: analysis.posts_count,
              samples: analysis.samples,
            },
          })
          if (result?.scripts) { onResult(result.scripts); setDone(true) }
        } catch (err) { console.warn('AI script gen failed:', err.message) }
        finally { setLoading(false) }
      }}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-teal-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(124,58,237,0.6)] transition-all hover:scale-[1.02] disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {done ? 'Generated' : loading ? 'Writing scripts...' : 'AI Generate Scripts'}
    </button>
  )
}

function ScriptsCard({ scripts, scriptsAi }) {
  const [copiedIdx, setCopiedIdx] = useState(-1)
  if ((!scripts || scripts.length === 0) && (!scriptsAi || scriptsAi.length === 0)) {
    return <PlaceholderCard title="Steal This Script" subtitle="Templates appear once we have a structural blueprint" />
  }
  const hasAi = Array.isArray(scriptsAi) && scriptsAi.length > 0
  const list = hasAi ? scriptsAi : scripts
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
          <PenTool className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold flex items-center gap-2">
            Steal This Script
            {hasAi && (
              <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5">
                AI-written
              </span>
            )}
          </div>
          <div className="text-xs text-[#64756f]">
            {hasAi
              ? 'Fully-written scripts that mirror your winning style and use your high-traction phrases'
              : 'Fill-in-the-blank templates derived from your winning structure'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {list.map((s, i) => (
          <div key={i} className="relative rounded-xl bg-slate-50 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Script {i + 1}</div>
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800 font-medium">{s}</pre>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(s).then(() => {
                  setCopiedIdx(i)
                  setTimeout(() => setCopiedIdx(-1), 1500)
                })
              }}
              className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#64756f] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] hover:bg-slate-100"
            >
              <Copy className="h-3 w-3" />
              {copiedIdx === i ? 'Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaceholderCard({ title, subtitle }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="text-base font-bold">{title}</div>
      <div className="mt-1 text-xs text-[#64756f]">{subtitle}</div>
      <div className="mt-4 grid place-items-center py-8 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    </div>
  )
}

function ProLockedHero() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-violet-50 p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      {/* Subtle decorative grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,1) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500 text-white shadow-[0_8px_24px_-8px_rgba(245,158,11,0.6)]">
            <Crown className="h-4 w-4" />
          </span>
          <span className="rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold px-2.5 py-1">Pro feature</span>
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Script Studio</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600 leading-relaxed">
          A mathematical copywriting blueprint built from your own engagement history.
          We compute a per-post performance delta against your median baseline,
          then run a log-odds analysis to surface the exact phrases driving your
          winners — and the dead phrases dragging you down.
        </p>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FeatureBullet Icon={BarChart3} title="Performance Distribution" copy="See exactly where every post lands vs your baseline" />
          <FeatureBullet Icon={Sparkles}  title="Verified Lexicon" copy="High-traction phrases · dead phrases · with statistical lift %" />
          <FeatureBullet Icon={PenTool}   title="Steal-This-Script" copy="3 fill-in-the-blank templates mirroring your winning structure" />
        </div>
        <button
          onClick={() => alert('Upgrade flow coming — contact us to enable Pro')}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-5 text-sm shadow-[0_8px_24px_-8px_rgba(15,23,42,0.5)] transition-transform hover:scale-[1.02]"
        >
          Upgrade to unlock <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function FeatureBullet({ Icon, title, copy }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="text-xs font-bold text-slate-900">{title}</div>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">{copy}</div>
    </div>
  )
}

export default function ScriptStudioPane({ timeRange }) {
  const { user } = useAuth()
  const { tier } = useTier()
  const isPaid = tier === 'standard' || tier === 'premium'
  const [handle, setHandle] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data: row } = await supabase
        .from('tracked_accounts')
        .select('username')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) setHandle(row?.username || null)
    })()
    return () => { cancelled = true }
  }, [user])

  const hydrate = useCallback(async (h, opts = {}) => {
    setLoading(true)
    setError(null)

    if (!opts.force) {
      const cached = loadCache(h)
      if (cached) {
        setData(cached)
        setLoading(false)
      }
    }
    try {
      const result = await fetchScriptStudio(h, {
        force: !!opts.force,
        onUpdate: (fresh) => {
          if (fresh) {
            setData(fresh)
            saveCache(h, fresh)
          }
        },
      })
      if (result) {
        setData(result)
        saveCache(h, result)
      }
    } catch (err) {
      // Treat ANY error as "insufficient data" when we have no data yet.
      // The previous code showed a red crash card with "Proxy request failed (200)"
      // because the proxy returns { ok: false, reason: 'no-posts' } with no error field.
      const msg = err.message || 'Analysis failed'
      setError(/insufficient|no.?posts|not found/i.test(msg) ? 'insufficient-posts' : msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!handle) return
    hydrate(handle)
  }, [handle, hydrate])

  // Pro gate — Script Studio is paid-only. Show a marketing hero with the
  // value proposition for free users, full pane for standard/premium.
  if (!isPaid) {
    return (
      <>
        <PaneHeader title="Script Studio" subtitle="Mathematical copywriting blueprint from your post history" />
        <ProLockedHero />
      </>
    )
  }

  if (!handle) {
    return (
      <>
        <PaneHeader title="Script Studio" subtitle="Mathematical copywriting blueprint from your post history" />
        <div className="rounded-3xl bg-white p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <PenTool className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">Track an account first</h3>
          <p className="mt-1 text-sm text-[#64756f]">Add an Instagram account in your dashboard to unlock Script Studio.</p>
        </div>
      </>
    )
  }

  if (error) {
    const isNoData = /no.?posts|insufficient|not found|empty|private/i.test(error)
    const isNetwork = /proxy|network|timeout|fetch|503|502/i.test(error)
    return (
      <>
        <PaneHeader title="Script Studio" subtitle={`@${handle}`} onRefresh={() => hydrate(handle, { force: true })} />
        <div className="rounded-3xl bg-white p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <PenTool className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            {isNoData ? 'Not enough posts to analyse' : isNetwork ? 'Temporarily unavailable' : 'Analysis couldn\'t complete'}
          </h3>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {isNoData
              ? 'Script Studio needs at least 10 public posts to compute engagement patterns, identify winning phrases, and build your structural blueprint. This account doesn\'t have enough content yet.'
              : isNetwork
                ? 'The data service is temporarily unreachable. This usually resolves in a minute. Try refreshing.'
                : `Something went wrong: ${error}`}
          </p>
          {isNoData && (
            <p className="mt-3 text-xs text-slate-400">
              Want to see Script Studio in action? Try tracking @natgeotravel or @nasa — accounts with rich post histories.
            </p>
          )}
          <button
            onClick={() => hydrate(handle, { force: true })}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-200"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      </>
    )
  }

  const ready = data && data.ok
  const insufficient = data && !data.ok && data.reason === 'insufficient-posts'

  return (
    <>
      <PaneHeader
        title="Script Studio"
        subtitle={ready ? `${data.posts_count} posts analysed for @${handle}` : `Analysing @${handle}`}
        stale={loading}
        onRefresh={() => hydrate(handle, { force: true })}
      />
      {insufficient && (
        <div className="rounded-3xl bg-white p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <PenTool className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">Not enough posts yet</h3>
          <p className="mt-1 text-sm text-[#64756f]">We need at least 10 recent posts to compute a baseline. @{handle} has {data.posts_count} so far.</p>
        </div>
      )}
      {!insufficient && (
        <div className="space-y-4">
          {ready ? (
            <DistributionCard distribution={data.distribution} baselines={data.baselines} buckets={data.buckets} />
          ) : <Skeleton className="h-44 w-full rounded-3xl" />}
          {ready ? (
            <LexiconCard lexicon={data.lexicon} />
          ) : <Skeleton className="h-64 w-full rounded-3xl" />}
          {ready ? (
            <BlueprintCard blueprint={data.blueprint} />
          ) : <Skeleton className="h-32 w-full rounded-3xl" />}
          {ready ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span />
                <AIGenerateButton analysis={data} onResult={(ai) => setData((d) => ({ ...d, scripts_ai: ai }))} />
              </div>
              <ScriptsCard scripts={data.scripts} scriptsAi={data.scripts_ai} />
            </>
          ) : <Skeleton className="h-48 w-full rounded-3xl" />}
        </div>
      )}
    </>
  )
}
