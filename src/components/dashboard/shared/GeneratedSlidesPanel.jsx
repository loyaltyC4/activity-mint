/**
 * GeneratedSlidesPanel — floating right-side drawer showing AI-generated
 * carousel slides as they appear. Shared between Ad Intelligence and
 * Template Studio.
 *
 * Uses an inline slide-in panel (not shadcn Sheet, to avoid the Radix
 * dependency). Pure CSS transition.
 */

'use strict'

import React, { useState } from 'react'
import {
  X, Download, BookmarkPlus, Loader2, Sparkles, Copy,
  CheckCircle2, PenTool,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchAIInsights } from '../../../lib/apify'

export default function GeneratedSlidesPanel({
  open,
  onClose,
  slides = [],      // [{ index, url, prompt, error }]
  generating,        // boolean — still generating
  templateName,      // e.g. "Stat Shock Carousel" or "Nike Ad Replica"
  brandContext,      // { voice, pillars } for caption generation
  onSave,            // called when user clicks "Save Template"
}) {
  const [caption, setCaption] = useState(null)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const completed = slides.filter((s) => s?.url)
  const total = slides.length || 0

  const handleGenerateCaption = async () => {
    setCaptionLoading(true)
    try {
      const r = await fetchAIInsights({
        request_type: 'scripts',
        topic: templateName,
        analysis: brandContext ? {
          blueprint: { common_opener: { label: brandContext.voice || 'Plain' } },
          lexicon: { winners: (brandContext.pillars || []).map((p) => ({ phrase: p })) },
        } : null,
      })
      if (r?.scripts?.[0]) setCaption(r.scripts[0])
    } catch {}
    finally { setCaptionLoading(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative w-full max-w-md bg-white shadow-2xl flex flex-col',
        'animate-in slide-in-from-right duration-300'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Generated</div>
            <div className="text-base font-bold text-slate-900">{templateName || 'Slides'}</div>
          </div>
          <div className="flex items-center gap-2">
            {generating && (
              <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                {completed.length}/{total}
              </span>
            )}
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Slides grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: total }).map((_, i) => {
              const slide = slides[i]
              const hasImage = slide?.url
              return (
                <div key={i} className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
                  {hasImage ? (
                    <>
                      <img src={slide.url} alt={`Slide ${i + 1}`}
                        className="h-full w-full object-cover animate-in fade-in duration-500" />
                      <a
                        href={slide.url}
                        download={`slide-${i + 1}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-slate-600 hover:bg-white shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </>
                  ) : slide?.error ? (
                    <div className="h-full w-full bg-rose-50 flex items-center justify-center p-3">
                      <p className="text-[10px] text-rose-500 text-center">Failed</p>
                    </div>
                  ) : (
                    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 text-slate-300 animate-spin" />
                      <span className="text-[10px] text-slate-400">Slide {i + 1}</span>
                    </div>
                  )}
                  {/* Slide number badge */}
                  <div className="absolute top-2 left-2 grid h-5 w-5 place-items-center rounded-md bg-black/50 text-[9px] font-bold text-white">
                    {i + 1}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Caption section */}
          <div className="mt-4 rounded-xl bg-slate-50 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Caption</div>
              {!caption && (
                <button onClick={handleGenerateCaption} disabled={captionLoading}
                  className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-teal-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:scale-[1.02] transition-all disabled:opacity-60">
                  {captionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenTool className="h-3 w-3" />}
                  {captionLoading ? 'Writing...' : 'AI Caption'}
                </button>
              )}
            </div>
            {caption ? (
              <div>
                <pre className="whitespace-pre-wrap text-[12px] text-slate-700 leading-relaxed font-medium mb-2">{caption}</pre>
                <button onClick={() => { navigator.clipboard?.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
                  {copied ? <CheckCircle2 className="h-3 w-3 text-teal-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy caption'}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">Click AI Caption to generate a ready-to-post caption.</p>
            )}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
          {onSave && (
            <button onClick={onSave}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800">
              <BookmarkPlus className="h-3.5 w-3.5" /> Save Template
            </button>
          )}
          <div className="text-[10px] text-slate-400">
            {completed.length === total && total > 0 ? 'All slides ready' : generating ? `${completed.length}/${total} generated` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
