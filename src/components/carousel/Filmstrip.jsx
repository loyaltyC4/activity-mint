/**
 * Filmstrip — vertical sortable slide strip using @dnd-kit/sortable.
 *
 * Each thumbnail is a mini scaled-down iframe of the actual slide HTML,
 * so the preview matches exactly what will be exported. Drag-to-reorder
 * calls PUT /api/carousel/:id/slides with the new slideIds order.
 */
'use strict'

import React, { useRef, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, GripVertical, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const DIMENSIONS = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
}

const THUMB_W = 160  // px — filmstrip thumbnail width

function SlideThumbnail({ slide, aspectRatio, isActive, onSelect, onDelete, isDragging }) {
  const { width: nW, height: nH } = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']
  const scale = THUMB_W / nW
  const thumbH = Math.round(nH * scale)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: slide.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Minimal inline HTML for the thumbnail (no external fonts for speed)
  const thumbDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${nW}px;height:${nH}px;overflow:hidden}</style></head><body>${slide.html || ''}</body></html>`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col gap-1 cursor-pointer select-none ${isDragging ? 'z-50' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0.5 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1"
      >
        <GripVertical className="size-3 text-white drop-shadow" strokeWidth={2} />
      </div>

      {/* Thumbnail container */}
      <div
        onClick={() => onSelect(slide.id)}
        className={`relative rounded overflow-hidden ring-2 transition-all ${
          isActive
            ? 'ring-brand shadow-glow'
            : 'ring-transparent hover:ring-foreground/20'
        }`}
        style={{ width: THUMB_W, height: thumbH }}
      >
        <iframe
          key={slide.id + (slide.html?.length || 0)} // re-render when HTML changes
          srcDoc={thumbDoc}
          sandbox="allow-same-origin"
          style={{
            width:  nW,
            height: nH,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
          title=""
          aria-hidden
        />

        {/* Active indicator overlay */}
        {isActive && (
          <div className="absolute inset-0 ring-2 ring-inset ring-brand rounded pointer-events-none" />
        )}

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(slide.id) }}
          className="absolute top-1 right-1 size-5 rounded grid place-items-center bg-negative/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-negative"
          title="Delete slide"
        >
          <Trash2 className="size-2.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Slide order + notes label */}
      <div className="px-0.5">
        <div className="font-mono text-[9px] text-muted-foreground truncate">
          {slide.slide_order + 1}. {slide.notes || slide.headline || 'Slide'}
        </div>
      </div>
    </div>
  )
}

export default function Filmstrip({
  carouselId,
  slides = [],
  activeSlideId,
  aspectRatio = '4:5',
  onSlideSelect,
  onSlideDeleted,
  onSlidesReordered,
  onAddSlide,
}) {
  const [localSlides, setLocalSlides] = useState(slides)
  const [deletingId, setDeletingId] = useState(null)
  const activeRef = useRef(null)

  // Keep local slides in sync when parent updates
  useEffect(() => { setLocalSlides(slides) }, [slides])

  // Auto-scroll to keep active slide visible
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeSlideId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localSlides.findIndex(s => s.id === active.id)
    const newIndex = localSlides.findIndex(s => s.id === over.id)
    const reordered = arrayMove(localSlides, oldIndex, newIndex)
      .map((s, i) => ({ ...s, slide_order: i }))

    setLocalSlides(reordered)
    onSlidesReordered?.(reordered)

    // Persist order to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/carousel/${carouselId}/slides`, {
        method:  'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ slideIds: reordered.map(s => s.id) }),
      })
    } catch (err) {
      console.error('[Filmstrip] reorder failed:', err)
    }
  }

  async function handleDelete(slideId) {
    if (deletingId) return
    if (!confirm('Delete this slide?')) return
    setDeletingId(slideId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/carousel/${carouselId}/slides/${slideId}`, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      onSlideDeleted?.(slideId)
    } catch (err) {
      console.error('[Filmstrip] delete failed:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const { width: nW, height: nH } = DIMENSIONS[aspectRatio] || DIMENSIONS['4:5']
  const scale = THUMB_W / nW
  const thumbH = Math.round(nH * scale)

  return (
    <div
      className="flex flex-col gap-3 px-3 py-3 overflow-y-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <style>{`div::-webkit-scrollbar{display:none}`}</style>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localSlides.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {localSlides.map((slide) => (
            <div key={slide.id} ref={slide.id === activeSlideId ? activeRef : null}>
              <SlideThumbnail
                slide={slide}
                aspectRatio={aspectRatio}
                isActive={slide.id === activeSlideId}
                onSelect={onSlideSelect}
                onDelete={handleDelete}
                isDragging={deletingId === slide.id}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add slide button */}
      {onAddSlide && (
        <button
          onClick={onAddSlide}
          className="flex items-center justify-center gap-1.5 rounded-lg ring-1 ring-dashed ring-foreground/15 text-muted-foreground hover:ring-brand hover:text-brand-ink transition-all text-xs py-2"
          style={{ width: THUMB_W }}
          title="Ask Claude to add a slide"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          Add slide
        </button>
      )}

      {localSlides.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-lg ring-1 ring-dashed ring-foreground/10 text-muted-foreground text-xs gap-1 py-8 text-center"
          style={{ width: THUMB_W, minHeight: thumbH }}
        >
          <span>No slides yet</span>
          <span className="opacity-60">Type a topic in the chat →</span>
        </div>
      )}
    </div>
  )
}
