/**
 * CarouselPane — entry point pane for Carousel Studio.
 *
 * Three views managed internally:
 *   'setup'  — BrandDNASetup onboarding (shown when no brand_dna row exists)
 *   'list'   — carousel grid with brand DNA summary card at top
 *   'editor' — CarouselEditor (three-panel slide builder)
 *
 * Uses shadcn: Card, CardHeader, CardTitle, CardDescription, CardContent,
 *              CardFooter, Button, Badge, Dialog + DialogContent etc.
 */

'use strict'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Columns2, Plus, Trash2, Clock, Layers,
  Sparkles, RefreshCw, Loader2, ArrowRight,
  CheckCircle2, Palette, Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button }   from '@/components/ui/button'
import { Badge }    from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input }    from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { supabase }      from '../../../lib/supabase'
import BrandDNASetup     from '../../carousel/BrandDNASetup'
import CarouselEditor    from '../../carousel/CarouselEditor'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1',  desc: 'Feed square',      shape: 'w-8 h-8' },
  { value: '4:5',  label: '4:5',  desc: 'Portrait feed',    shape: 'w-7 h-9' },
  { value: '9:16', label: '9:16', desc: 'Reels / Stories',  shape: 'w-5 h-9' },
]

// ─── Brand DNA summary card ───────────────────────────────────────────────────

function BrandDNASummary({ brandDNA, onRefresh, refreshing }) {
  if (!brandDNA) return null
  const swatches = [
    { color: brandDNA.primary_color,    label: 'Primary' },
    { color: brandDNA.accent_color,     label: 'Accent' },
    { color: brandDNA.background_color, label: 'Background' },
  ]

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: identity */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 grid place-items-center text-primary font-bold text-sm flex-shrink-0">
              {brandDNA.handle?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-semibold text-sm">@{brandDNA.handle}</div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{brandDNA.niche}</Badge>
                <Badge variant="outline"   className="text-[10px] h-4 px-1.5">{brandDNA.goal}</Badge>
              </div>
            </div>
          </div>

          {/* Center: colors + font */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Palette className="size-3.5 text-muted-foreground" />
              <div className="flex gap-1">
                {swatches.map(s => (
                  <div
                    key={s.label}
                    className="size-4 rounded-full ring-1 ring-foreground/10"
                    style={{ background: s.color }}
                    title={`${s.label}: ${s.color}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Type className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-mono text-muted-foreground">
                {brandDNA.heading_font || 'Inter'}
              </span>
            </div>
          </div>

          {/* Right: hooks + refresh */}
          <div className="flex items-center gap-3 ml-auto">
            {brandDNA.top_hooks?.length > 0 && (
              <div className="hidden lg:block text-[11px] text-muted-foreground max-w-[280px] truncate" title={brandDNA.top_hooks[0]}>
                Hook: <em>{brandDNA.top_hooks[0]}</em>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-7 gap-1.5 text-xs"
            >
              {refreshing
                ? <Loader2 className="size-3 animate-spin" />
                : <RefreshCw className="size-3" />
              }
              Re-analyze
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── New carousel dialog ──────────────────────────────────────────────────────

function NewCarouselDialog({ open, onClose, onCreate }) {
  const [name, setName]           = useState('')
  const [aspectRatio, setAspect]  = useState('4:5')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give your carousel a name'); return }
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/carousels', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body:    JSON.stringify({ name: trimmed, aspectRatio }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`) }
      const carousel = await res.json()
      setName(''); setLoading(false); onCreate(carousel)
    } catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New carousel</DialogTitle>
          <DialogDescription>Name it and choose your format. You can change these later.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. 3 mistakes founders make"
            />
          </div>

          {/* Aspect ratio */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setAspect(r.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3.5 rounded-lg border transition-all',
                    aspectRatio === r.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/30 hover:bg-accent/40'
                  )}
                >
                  <div className={cn('rounded-sm ring-1 ring-foreground/15 bg-foreground/[0.06]', r.shape)} />
                  <div className="text-center">
                    <div className={cn('text-xs font-semibold', aspectRatio === r.value && 'text-primary')}>{r.label}</div>
                    <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
            Create carousel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Carousel card ────────────────────────────────────────────────────────────

function CarouselCard({ carousel, onOpen, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const slides = carousel.slides?.length ?? 0

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirm(`Delete "${carousel.name}"?`)) return
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/carousel/${carousel.id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    onDelete(carousel.id)
  }

  const ratio = carousel.aspect_ratio || '4:5'
  const shapeMap = { '1:1': 'w-7 h-7', '4:5': 'w-6 h-8', '9:16': 'w-4 h-8' }

  return (
    <Card
      className={cn('group cursor-pointer hover:shadow-md transition-all hover:border-primary/30', deleting && 'opacity-50')}
      onClick={() => !deleting && onOpen(carousel.id)}
    >
      {/* Thumbnail area */}
      <div className="h-32 bg-gradient-to-br from-muted/50 to-primary/5 rounded-t-lg flex items-center justify-center relative">
        <div className={cn('rounded-sm ring-1 ring-foreground/15 bg-background/80', shapeMap[ratio] || shapeMap['4:5'])} />
        <Badge variant="outline" className="absolute top-2.5 right-2.5 text-[9px] font-mono h-4 px-1">
          {ratio}
        </Badge>
        {carousel.export_url && (
          <div className="absolute top-2.5 left-2.5 size-4 rounded-full bg-primary/20 grid place-items-center">
            <CheckCircle2 className="size-2.5 text-primary" />
          </div>
        )}
        {/* Delete button on hover */}
        <button
          onClick={handleDelete}
          className="absolute bottom-2 right-2 size-6 rounded grid place-items-center bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <CardContent className="p-4">
        <div className="font-semibold text-sm truncate">{carousel.name}</div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <Layers className="size-3" />{slides} slide{slides !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />{formatDate(carousel.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main pane ────────────────────────────────────────────────────────────────

export default function CarouselPane() {
  const [view, setView]           = useState('loading')  // 'loading' | 'setup' | 'list' | 'editor'
  const [brandDNA, setBrandDNA]   = useState(null)
  const [carousels, setCarousels] = useState([])
  const [activeId, setActiveId]   = useState(null)
  const [showNew, setShowNew]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError]         = useState(null)

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setView('list'); return }

        const [dnaRes, carRes] = await Promise.all([
          supabase
            .from('brand_dna')
            .select('*')
            .eq('user_id', session.user.id)
            .order('extracted_at', { ascending: false })
            .limit(1)
            .single(),
          fetch('/api/carousels', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ])

        if (cancelled) return

        if (!dnaRes.error && dnaRes.data) {
          setBrandDNA(dnaRes.data)
          const carData = await carRes.json().catch(() => ({ carousels: [] }))
          setCarousels(carData.carousels || [])
          setView('list')
        } else {
          setView('setup')
        }
      } catch {
        setView('setup')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Re-fetch carousels when switching back to list ─────────────────────────
  useEffect(() => {
    if (view !== 'list') return
    let cancelled = false
    async function refresh() {
      setListLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/carousels', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      const data = await res.json().catch(() => ({ carousels: [] }))
      if (!cancelled) { setCarousels(data.carousels || []); setListLoading(false) }
    }
    refresh()
    return () => { cancelled = true }
  }, [view])

  // ── Re-analyze brand DNA ───────────────────────────────────────────────────
  async function handleRefreshDNA() {
    if (!brandDNA) return
    setRefreshing(true)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/brand-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          handle:      brandDNA.handle,
          niche:       brandDNA.niche,
          goal:        brandDNA.goal,
          customerDesc: brandDNA.customer_desc,
        }),
      })
      if (res.ok) {
        const { brandDNA: fresh } = await res.json()
        setBrandDNA(fresh)
      }
    } finally {
      setRefreshing(false)
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleSetupComplete = useCallback((dna) => {
    // Map api response (camelCase) → db column names for display
    setBrandDNA({
      handle:           dna.handle,
      niche:            dna.niche,
      goal:             dna.goal,
      primary_color:    dna.primaryColor,
      accent_color:     dna.accentColor,
      background_color: dna.backgroundColor,
      heading_font:     dna.headingFont,
      top_hooks:        dna.topHooks,
      customer_desc:    dna.customerDesc,
    })
    setView('list')
  }, [])

  const handleOpen    = (id)       => { setActiveId(id); setView('editor') }
  const handleCreate  = (carousel) => { setShowNew(false); setCarousels(prev => [carousel, ...prev]); handleOpen(carousel.id) }
  const handleDelete  = (id)       => setCarousels(prev => prev.filter(c => c.id !== id))

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-6 text-primary animate-spin" />
      </div>
    )
  }

  if (view === 'setup') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">Carousel Studio</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Let's analyse your account first — it only takes 30 seconds and makes every carousel on-brand automatically.
          </p>
        </div>
        <BrandDNASetup onComplete={handleSetupComplete} />
      </div>
    )
  }

  if (view === 'editor' && activeId) {
    return <CarouselEditor carouselId={activeId} onBack={() => setView('list')} />
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <>
      <NewCarouselDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreate={handleCreate}
      />

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">Carousel Studio</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Give Claude a topic — it builds the full carousel in your brand voice, slide by slide.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="size-4" /> New carousel
        </Button>
      </div>

      {/* Brand DNA summary */}
      <BrandDNASummary
        brandDNA={brandDNA}
        onRefresh={handleRefreshDNA}
        refreshing={refreshing}
      />

      {/* Carousels grid */}
      {listLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 text-primary animate-spin" />
        </div>
      ) : carousels.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="size-16 rounded-2xl bg-primary/10 grid place-items-center">
              <Columns2 className="size-8 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-lg">No carousels yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create your first carousel and Claude will build it for you in seconds.
              </p>
            </div>
            <Button onClick={() => setShowNew(true)} className="gap-1.5">
              <Plus className="size-4" /> New carousel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {carousels.map(c => (
            <CarouselCard
              key={c.id}
              carousel={c}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* CTA if no brand DNA yet but carousels exist (edge case) */}
      {!brandDNA && carousels.length > 0 && (
        <Card className="border-primary/20 bg-primary/[0.02] mt-2">
          <CardContent className="flex items-center justify-between gap-4 py-4 px-5">
            <div>
              <p className="text-sm font-semibold">No brand DNA yet</p>
              <p className="text-xs text-muted-foreground">Run analysis to make your slides automatically match your brand.</p>
            </div>
            <Button size="sm" onClick={() => setView('setup')} className="gap-1.5 flex-shrink-0">
              <Sparkles className="size-4" /> Analyze my account
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
