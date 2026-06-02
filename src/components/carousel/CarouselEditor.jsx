/**
 * CarouselEditor — three-panel shell for the carousel creation experience.
 *
 * ┌──────────────┬─────────────────────────┬───────────────┐
 * │   Filmstrip  │      SlidePreview       │   ChatPanel   │
 * │  ~196px      │       (flex-1)          │   ~320px      │
 * └──────────────┴─────────────────────────┴───────────────┘
 *
 * State ownership: all carousel + slide state lives here and flows down
 * as props. ChatPanel communicates back via onSlide* callbacks so this
 * component stays the single source of truth.
 */
'use strict'

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Filmstrip      from './Filmstrip'
import SlidePreview   from './SlidePreview'
import ChatPanel      from './ChatPanel'
import BrandDNABadge  from './BrandDNABadge'
import ExportButton   from './ExportButton'

export default function CarouselEditor({ carouselId, onBack }) {
  const [carousel, setCarousel]       = useState(null)
  const [slides, setSlides]           = useState([])
  const [activeSlideId, setActiveSlideId] = useState(null)
  const [brandDNA, setBrandDNA]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  // ── Fetch carousel + brand DNA ──────────────────────────────────────────
  useEffect(() => {
    if (!carouselId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('Not authenticated')
        const auth = { Authorization: `Bearer ${token}` }

        const [carouselRes, brandRes] = await Promise.all([
          fetch(`/api/carousel/${carouselId}`, { headers: auth }),
          supabase
            .from('brand_dna')
            .select('*')
            .eq('user_id', session.user.id)
            .order('extracted_at', { ascending: false })
            .limit(1)
            .single(),
        ])

        if (!carouselRes.ok) throw new Error(`Failed to load carousel (${carouselRes.status})`)
        const carouselData = await carouselRes.json()

        if (!cancelled) {
          setCarousel(carouselData)
          const orderedSlides = (carouselData.slides || []).sort((a, b) => a.slide_order - b.slide_order)
          setSlides(orderedSlides)
          setActiveSlideId(orderedSlides[0]?.id || null)
          if (!brandRes.error) setBrandDNA(brandRes.data)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [carouselId])

  // ── Slide event handlers (from ChatPanel + Filmstrip) ──────────────────

  const handleSlideCreated = useCallback((slide) => {
    setSlides(prev => {
      const exists = prev.some(s => s.id === slide.id)
      const updated = exists ? prev : [...prev, slide]
      return updated.sort((a, b) => a.slide_order - b.slide_order)
    })
    setActiveSlideId(slide.id)
  }, [])

  const handleSlideUpdated = useCallback((slide) => {
    setSlides(prev =>
      prev.map(s => s.id === slide.id ? { ...s, ...slide } : s)
    )
    // Keep active on updated slide so user sees the change immediately
    setActiveSlideId(slide.id)
  }, [])

  const handleSlideDeleted = useCallback((slideId) => {
    setSlides(prev => {
      const remaining = prev.filter(s => s.id !== slideId)
        .map((s, i) => ({ ...s, slide_order: i }))
      if (activeSlideId === slideId) {
        setActiveSlideId(remaining[0]?.id || null)
      }
      return remaining
    })
  }, [activeSlideId])

  const handleCaptionSaved = useCallback((data) => {
    setCarousel(prev => prev ? { ...prev, ...data } : prev)
  }, [])

  const handleSlidesReordered = useCallback((reordered) => {
    setSlides(reordered)
  }, [])

  // ── Add slide: prompt Claude via a pre-filled message ──────────────────
  // (The ChatPanel handles input — this is for the Filmstrip's + button)
  const addSlidePromptRef = React.useRef(null)
  function handleAddSlide() {
    // Focus the ChatPanel input and pre-fill a prompt
    document.getElementById('carousel-chat-input')?.focus()
  }

  const activeSlide = slides.find(s => s.id === activeSlideId) || slides[0] || null

  // ── Loading / error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="size-6 text-brand animate-spin" strokeWidth={2} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4">
        <p className="text-sm text-negative">{error}</p>
        <button onClick={onBack} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Back to carousels
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-hairline bg-background shrink-0">
        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="size-7 grid place-items-center rounded-lg hover:bg-foreground/[0.04] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Back to carousels"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-base tracking-tight truncate">
              {carousel?.name || 'Untitled carousel'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {carousel?.aspect_ratio || '4:5'}
              </span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {slides.length} slide{slides.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Right: brand badge + export */}
        <div className="flex items-center gap-3 shrink-0">
          <BrandDNABadge brandDNA={brandDNA} handle={brandDNA?.handle} />
          <ExportButton carouselId={carouselId} slideCount={slides.length} />
        </div>
      </div>

      {/* ── Three-panel body ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Filmstrip */}
        <div className="w-[196px] shrink-0 border-r border-hairline overflow-y-auto bg-surface-2/30">
          <Filmstrip
            carouselId={carouselId}
            slides={slides}
            activeSlideId={activeSlideId}
            aspectRatio={carousel?.aspect_ratio || '4:5'}
            onSlideSelect={setActiveSlideId}
            onSlideDeleted={handleSlideDeleted}
            onSlidesReordered={handleSlidesReordered}
            onAddSlide={handleAddSlide}
          />
        </div>

        {/* Center: Slide preview */}
        <div className="flex-1 min-w-0 flex items-center justify-center p-6 bg-surface-2/20">
          <SlidePreview
            slide={activeSlide}
            aspectRatio={carousel?.aspect_ratio || '4:5'}
            className="w-full h-full max-w-[600px] max-h-full"
          />
        </div>

        {/* Right: Chat panel */}
        <div className="w-[320px] shrink-0 border-l border-hairline flex flex-col">
          <ChatPanel
            carouselId={carouselId}
            brandDNA={brandDNA}
            onSlideCreated={handleSlideCreated}
            onSlideUpdated={handleSlideUpdated}
            onSlideDeleted={handleSlideDeleted}
            onCaptionSaved={handleCaptionSaved}
            className="flex-1 min-h-0 flex flex-col"
          />
        </div>

      </div>
    </div>
  )
}
