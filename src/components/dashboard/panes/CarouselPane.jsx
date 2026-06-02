/**
 * CarouselPane — entry point pane for the carousel feature.
 *
 * List view: grid of carousel cards. "New carousel" creates a fresh record
 * with a name + aspect ratio picker, then opens the editor immediately.
 *
 * Navigation: switches between 'list' and 'editor' views within the pane
 * (no router — same pattern as the rest of the dashboard).
 *
 * Icon: Columns2 from lucide — not used anywhere in the Sidebar, safe from
 * Vite circular-chunk collision.
 */
'use strict'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Columns2, Plus, Loader2, Trash2, Clock,
  Image as ImageIcon, Layers,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import SectionCard    from '../shared/SectionCard'
import CarouselEditor from '../../carousel/CarouselEditor'

const ASPECT_RATIOS = [
  { value: '1:1',  label: '1:1',  desc: 'Feed square' },
  { value: '4:5',  label: '4:5',  desc: 'Portrait feed' },
  { value: '9:16', label: '9:16', desc: 'Reels / Stories' },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AspectRatioIcon({ ratio }) {
  const cls = {
    '1:1':  'w-8 h-8',
    '4:5':  'w-7 h-9',
    '9:16': 'w-5 h-9',
  }[ratio] || 'w-7 h-9'
  return (
    <div className={`rounded-sm ring-1 ring-foreground/15 bg-foreground/[0.04] ${cls}`} />
  )
}

// ─── New carousel modal ───────────────────────────────────────────────────────

function NewCarouselModal({ onClose, onCreate }) {
  const [name, setName]               = useState('')
  const [aspectRatio, setAspectRatio] = useState('4:5')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Give your carousel a name'); return }
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/carousels', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name: trimmed, aspectRatio }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const carousel = await res.json()
      onCreate(carousel)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-glow ring-1 ring-foreground/[0.08] p-6 w-full max-w-sm">
        <h3 className="font-display font-bold text-xl tracking-tight mb-5">New carousel</h3>

        {/* Name */}
        <label className="block mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Name</span>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. 3 mistakes founders make"
            className="mt-1.5 w-full bg-surface-2/60 ring-1 ring-foreground/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-brand transition-all"
          />
        </label>

        {/* Aspect ratio */}
        <div className="mb-5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground block mb-2">
            Aspect ratio
          </span>
          <div className="flex gap-2">
            {ASPECT_RATIOS.map(r => (
              <button
                key={r.value}
                onClick={() => setAspectRatio(r.value)}
                className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl ring-1 transition-all ${
                  aspectRatio === r.value
                    ? 'ring-brand bg-brand-soft'
                    : 'ring-foreground/[0.08] bg-surface-2/50 hover:ring-foreground/20'
                }`}
              >
                <AspectRatioIcon ratio={r.value} />
                <div className="text-center">
                  <div className={`text-xs font-semibold ${aspectRatio === r.value ? 'text-brand-ink' : ''}`}>{r.label}</div>
                  <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-negative mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl ring-1 ring-foreground/10 text-sm font-semibold hover:bg-foreground/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-white text-sm font-semibold hover:bg-brand hover:text-foreground transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Carousel card ────────────────────────────────────────────────────────────

function CarouselCard({ carousel, onOpen, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const slideCount = carousel.slides?.length ?? 0

  async function handleDelete(e) {
    e.stopPropagation()
    if (!confirm(`Delete "${carousel.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/carousel/${carousel.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      onDelete(carousel.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={() => onOpen(carousel.id)}
      disabled={deleting}
      className="group text-left bg-card rounded-2xl ring-1 ring-foreground/[0.06] shadow-pane hover:shadow-pop hover:ring-brand/30 transition-all overflow-hidden relative disabled:opacity-50"
    >
      {/* Preview area */}
      <div className="h-36 bg-gradient-to-br from-foreground/5 to-brand-soft relative flex items-center justify-center">
        <AspectRatioIcon ratio={carousel.aspect_ratio} />
        <div className="absolute top-3 right-3 flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded">
          {carousel.aspect_ratio}
        </div>
        {carousel.export_url && (
          <div className="absolute top-3 left-3 size-5 rounded-full bg-positive/20 grid place-items-center">
            <div className="size-1.5 rounded-full bg-positive" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="font-display font-semibold text-sm tracking-tight truncate">{carousel.name}</div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <Layers className="size-3" strokeWidth={2} />
            {slideCount} slide{slideCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" strokeWidth={2} />
            {formatDate(carousel.updated_at)}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 mt-8 size-6 rounded-md grid place-items-center bg-negative/10 text-negative opacity-0 group-hover:opacity-100 transition-opacity hover:bg-negative hover:text-white"
        title="Delete carousel"
      >
        <Trash2 className="size-3" strokeWidth={2} />
      </button>
    </button>
  )
}

// ─── Main pane ────────────────────────────────────────────────────────────────

export default function CarouselPane() {
  const [view, setView]           = useState('list')   // 'list' | 'editor'
  const [activeId, setActiveId]   = useState(null)
  const [carousels, setCarousels] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showModal, setShowModal] = useState(false)

  // ── Fetch carousel list ──────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'list') return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/carousels', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (!res.ok) throw new Error(`Failed to load carousels (${res.status})`)
        const { carousels: data } = await res.json()
        if (!cancelled) setCarousels(data || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [view])

  function handleOpen(id) {
    setActiveId(id)
    setView('editor')
  }

  function handleCreate(carousel) {
    setShowModal(false)
    setCarousels(prev => [carousel, ...prev])
    handleOpen(carousel.id)
  }

  function handleDelete(id) {
    setCarousels(prev => prev.filter(c => c.id !== id))
  }

  // ── Editor view ───────────────────────────────────────────────────────
  if (view === 'editor' && activeId) {
    return (
      <CarouselEditor
        carouselId={activeId}
        onBack={() => setView('list')}
      />
    )
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <>
      {showModal && (
        <NewCarouselModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-4xl tracking-tight leading-[1.05]">
            Carousel Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-prose">
            Give Claude a topic. It builds the entire carousel — slide by slide, in your brand voice.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-brand hover:text-foreground transition-all"
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
          New carousel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 text-brand animate-spin" strokeWidth={2} />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-negative">{error}</p>
        </div>
      ) : carousels.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="size-16 rounded-2xl bg-brand-soft grid place-items-center">
              <Columns2 className="size-8 text-brand" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-display font-semibold text-lg tracking-tight">No carousels yet</div>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Create your first carousel and Claude will build it for you in seconds.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-white text-sm font-semibold hover:bg-brand hover:text-foreground transition-all"
            >
              <Plus className="size-4" strokeWidth={2.25} />
              New carousel
            </button>
          </div>
        </SectionCard>
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
    </>
  )
}
