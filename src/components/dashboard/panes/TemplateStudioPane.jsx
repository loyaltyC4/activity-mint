/**
 * Template Studio — browse preset content templates, fill in fields from
 * Script Studio analysis data, preview generated slides.
 *
 * State machine with 3 views:
 *   1. gallery  — 6 template cards in a grid
 *   2. fill     — selected template with editable fields, auto-fill from cache
 *   3. preview  — generated slides grid (placeholders until API wiring)
 *
 * Template metadata is hardcoded here (not imported from api/_lib/) to avoid
 * bundler issues with server-only modules. The source of truth remains
 * api/_lib/templateLibrary.js.
 *
 * Data sources:
 *   - tracked handle: Supabase tracked_accounts (same as PulsePane)
 *   - Script Studio analysis: localStorage script_studio:v1:{handle}
 */

'use strict'

import React, { useEffect, useState, useCallback } from 'react'
import { Layers, Video, Image as ImageIcon, PenTool, ArrowLeft, ArrowRight, Sparkles, Download, BookmarkPlus, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE METADATA (mirrors api/_lib/templateLibrary.js)
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'stat_shock',
    name: 'Stat Shock Carousel',
    format: 'carousel',
    slide_count: 8,
    description: 'Open with a shocking statistic, break it down across 6 value slides, close with CTA. High-contrast dark background, bold white numbers.',
    framework: 'Hormozi Hook-Retain-Reward + PostEverywhere 8-10 slide rule',
    citation: 'PostEverywhere Feb 2026: 8-10 slides push ER past 2%. Hormozi $100M Leads: hook with a number that creates cognitive dissonance.',
    style: { bg: '#0f172a', text: '#ffffff', accent: '#14b8a6', font: 'Bold sans-serif (Inter/DM Sans)', mood: 'authoritative, data-driven' },
    fields: ['SHOCKING_STAT', 'TOPIC', 'POINT_1', 'POINT_2', 'POINT_3', 'POINT_4', 'POINT_5', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'Shock with a number', prompt: 'Instagram carousel slide, 1080x1350, dark navy (#0f172a) background. In the center, a very large bold white number "__SHOCKING_STAT__" taking up 40% of the slide. Below in smaller white text: "__TOPIC__". Clean minimal design, no images, just typography. Bold sans-serif font.' },
      { zone: 'hook2', purpose: 'Secondary hook (re-serve slide)', prompt: 'Instagram carousel slide, 1080x1350, dark navy (#0f172a) background. Bold white text reading "Here\'s why this matters" with a teal (#14b8a6) accent underline. Clean, minimal, typography-only.' },
      { zone: 'value', purpose: 'Point 1', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "01" in large teal (#14b8a6) text top-left. Below, bold white text: "__POINT_1__". Clean typography, no images.' },
      { zone: 'value', purpose: 'Point 2', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "02" in large teal text top-left. Below, bold white text: "__POINT_2__". Clean typography.' },
      { zone: 'value', purpose: 'Point 3', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "03" in large teal text top-left. Below, bold white text: "__POINT_3__". Clean typography.' },
      { zone: 'value', purpose: 'Point 4', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "04" in large teal text top-left. Below, bold white text: "__POINT_4__". Clean typography.' },
      { zone: 'value', purpose: 'Point 5', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "05" in large teal text top-left. Below, bold white text: "__POINT_5__". Clean typography.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Bold white text: "__CTA_TEXT__". Below, a teal (#14b8a6) arrow pointing right. Text "Swipe left for more" in small teal text at top. Clean, bold, minimal.' },
    ],
  },
  {
    id: 'chris_do_typography',
    name: 'Chris Do Typography Post',
    format: 'photo',
    slide_count: 1,
    description: 'Single-image post with one bold contrarian statement on a pure black or white background. Typography IS the content.',
    framework: 'Chris Do 5-Pillar: Hook + Clarity + X-Factor. The Futur.',
    citation: 'The Futur / Chris Do: "The headline must compel the viewer to dig deeper."',
    style: { bg: '#000000', text: '#ffffff', accent: '#ffffff', font: 'Extra-bold sans-serif, centered', mood: 'provocative, minimal' },
    fields: ['STATEMENT'],
    slides: [
      { zone: 'hook', purpose: 'Contrarian statement', prompt: 'Instagram post, 1080x1350, pure black (#000000) background. In the exact center, bold white text in a large clean sans-serif font: "__STATEMENT__". Nothing else on the slide. No images, no borders, no decoration. Just the text, perfectly centered, bold, large.' },
    ],
  },
  {
    id: 'behind_the_scenes_reel',
    name: 'Behind The Scenes Reel',
    format: 'reel',
    slide_count: 0,
    description: 'Script structure for a 15-25 second BTS reel. Hook (selfie), process (action shots), result (reveal).',
    framework: 'Gary Vee "Document Don\'t Create" + Hormozi Hook-Retain-Reward',
    citation: 'Gary Vaynerchuk: "Document, don\'t create." Hormozi: Hook captures, Retain shows value, Reward delivers the payoff.',
    style: { bg: 'n/a', text: 'n/a', accent: 'n/a', font: 'n/a', mood: 'authentic, raw' },
    fields: ['HOOK_LINE', 'PROCESS_DESCRIPTION', 'RESULT_REVEAL'],
    slides: [
      { zone: 'hook', purpose: 'Selfie hook (0-3s)', prompt: null, script: 'TO CAMERA: "__HOOK_LINE__" -- delivered directly, no intro, mid-energy. Film on phone, natural light.' },
      { zone: 'retain', purpose: 'Process montage (3-18s)', prompt: null, script: 'CUT TO: __PROCESS_DESCRIPTION__ -- 3-4 quick cuts of the work. No voiceover needed, just ambient sound or trending audio.' },
      { zone: 'reward', purpose: 'Result reveal (18-25s)', prompt: null, script: 'FINAL SHOT: __RESULT_REVEAL__ -- hold on the result for 3 seconds. Text overlay: "The result speaks."' },
    ],
  },
  {
    id: 'value_ladder',
    name: 'Value Ladder Carousel',
    format: 'carousel',
    slide_count: 10,
    description: '10-slide carousel that teaches 5 levels of a concept, from beginner to advanced. Numbered slides, clean progression.',
    framework: 'Hormozi Value Ladder + Chris Do 5-Pillar (Fulfillment)',
    citation: 'Hormozi: "The goal is to provide value upfront." PostEverywhere Feb 2026: 8-10 slides push ER past 2%.',
    style: { bg: '#ffffff', text: '#0f172a', accent: '#8b5cf6', font: 'Clean sans-serif, left-aligned', mood: 'educational, structured' },
    fields: ['TOPIC', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'Title slide', prompt: 'Instagram carousel slide, 1080x1350, white background. Bold dark text: "5 Levels of __TOPIC__" with a subtle purple (#8b5cf6) gradient underline. "From beginner to pro" in smaller grey text below. Clean, minimal, educational feel.' },
      { zone: 'hook2', purpose: 'Why this matters', prompt: 'Instagram carousel slide, 1080x1350, white background. Text: "Most people stay at Level 1. Here\'s how to reach Level 5." Dark text, purple accent on "Level 5". Swipe CTA at bottom.' },
      { zone: 'value', purpose: 'Level 1', prompt: 'Instagram carousel slide, 1080x1350, white background. Large purple "Level 1" badge top-left. Bold dark heading: "__LEVEL_1__".' },
      { zone: 'value', purpose: 'Level 2', prompt: 'Same style. "Level 2" badge. Heading: "__LEVEL_2__".' },
      { zone: 'value', purpose: 'Level 3', prompt: 'Same style. "Level 3" badge. Heading: "__LEVEL_3__".' },
      { zone: 'value', purpose: 'Level 4', prompt: 'Same style. "Level 4" badge. Heading: "__LEVEL_4__".' },
      { zone: 'value', purpose: 'Level 5', prompt: 'Same style. "Level 5" badge with gold accent. Heading: "__LEVEL_5__".' },
      { zone: 'value', purpose: 'Summary', prompt: 'Instagram carousel slide, 1080x1350, white background. Recap all 5 levels as a numbered list, dark text. Purple left border bar. Clean, scannable.' },
      { zone: 'value', purpose: 'Personal note', prompt: 'Instagram carousel slide, 1080x1350, white background. Handwritten-style text: "I was stuck at Level 2 for years." Dark italic text. Authentic tone.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, white background. Bold text: "__CTA_TEXT__". Purple arrow. "Save this for later" in small text.' },
    ],
  },
  {
    id: 'before_after',
    name: 'Before / After Carousel',
    format: 'carousel',
    slide_count: 8,
    description: 'Transformation story: slide 1 = the "before" state, slide 2-6 = the journey/process, slide 7-8 = the "after" + CTA.',
    framework: 'Hormozi PAS (Problem-Agitation-Solution) + carousel hook rules',
    citation: 'GetKoro.app Feb 2026: Hook-Value-CTA structure. AdLibrary.com May 2026: PAS framework for ad creation.',
    style: { bg: '#fafaf9', text: '#1c1917', accent: '#ea580c', font: 'Clean sans-serif', mood: 'transformational, honest' },
    fields: ['BEFORE_STATE', 'PAIN_POINT', 'STEP_1', 'STEP_2', 'STEP_3', 'AFTER_STATE', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'The Before state', prompt: 'Instagram carousel slide, 1080x1350, warm off-white background. Large bold dark text: "__BEFORE_STATE__". Red-orange (#ea580c) "BEFORE" tag in corner.' },
      { zone: 'hook2', purpose: 'The pain point', prompt: 'Instagram carousel slide, 1080x1350, warm off-white background. Text: "__PAIN_POINT__". Empathetic tone, dark text, red-orange accent underline.' },
      { zone: 'value', purpose: 'Step 1', prompt: 'Instagram carousel slide, 1080x1350, clean white background. "Step 1" in bold orange. Text: "__STEP_1__". Clean, actionable layout.' },
      { zone: 'value', purpose: 'Step 2', prompt: 'Same style. "Step 2". Text: "__STEP_2__".' },
      { zone: 'value', purpose: 'Step 3', prompt: 'Same style. "Step 3". Text: "__STEP_3__".' },
      { zone: 'value', purpose: 'The result', prompt: 'Instagram carousel slide, 1080x1350, warm off-white background. Large text: "The result?" in bold dark type. Building anticipation.' },
      { zone: 'reward', purpose: 'The After state', prompt: 'Instagram carousel slide, 1080x1350, clean bright background. Large bold text: "__AFTER_STATE__". Green "AFTER" tag in corner.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, warm background. Bold text: "__CTA_TEXT__". Orange accent.' },
    ],
  },
  {
    id: 'question_hook',
    name: 'Hormozi Question Carousel',
    format: 'carousel',
    slide_count: 8,
    description: 'Opens with a provocative question, answers it across value slides, closes with the truth bomb. Dark background, high contrast.',
    framework: 'Hormozi Question Hook + Hook-Retain-Reward',
    citation: 'WritingHooks.com (Hormozi hooks): "Why does __X__? Because __Y__." Go-Viral.app Feb 2026.',
    style: { bg: '#18181b', text: '#fafafa', accent: '#facc15', font: 'Extra-bold sans-serif', mood: 'provocative, confrontational' },
    fields: ['QUESTION', 'MYTH_1', 'MYTH_2', 'REAL_ANSWER', 'EVIDENCE_1', 'EVIDENCE_2', 'TRUTH_BOMB', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'The question', prompt: 'Instagram carousel slide, 1080x1350, near-black (#18181b) background. Large bold white text with yellow (#facc15) question mark: "__QUESTION__?"' },
      { zone: 'hook2', purpose: 'The myths', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Text: "Most people think:" then "__MYTH_1__" and "__MYTH_2__" each crossed out with a yellow strikethrough.' },
      { zone: 'value', purpose: 'The real answer', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Yellow "THE TRUTH" badge top. Bold white text: "__REAL_ANSWER__".' },
      { zone: 'value', purpose: 'Evidence 1', prompt: 'Instagram carousel slide, 1080x1350, near-black background. White text: "__EVIDENCE_1__". Data-driven, cited feel.' },
      { zone: 'value', purpose: 'Evidence 2', prompt: 'Instagram carousel slide, 1080x1350, near-black background. White text: "__EVIDENCE_2__". Supporting evidence.' },
      { zone: 'value', purpose: 'Summary', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Recap with numbered points in white text, yellow numbers.' },
      { zone: 'reward', purpose: 'Truth bomb close', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Large yellow text: "__TRUTH_BOMB__". Bold, centered, impactful.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, near-black background. White text: "__CTA_TEXT__". Yellow arrow. "Follow for more" in small text.' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-FILL LOGIC (mirrors api/_lib/templateLibrary.js autoFill)
// ─────────────────────────────────────────────────────────────────────────────

function autoFillFromAnalysis(templateId, analysis, topic) {
  const template = TEMPLATES.find((t) => t.id === templateId)
  if (!template || !analysis) return {}

  const winners = analysis?.lexicon?.winners || []
  const losers = analysis?.lexicon?.losers || []
  const blueprint = analysis?.blueprint || {}

  const values = {}

  if (templateId === 'stat_shock') {
    values.SHOCKING_STAT = analysis?.buckets
      ? `${Math.round((analysis.buckets.losers_n / (analysis.posts_count || 1)) * 100)}%`
      : '73%'
    values.TOPIC = topic || 'of posts underperform their potential'
    values.POINT_1 = winners[0] ? `Posts with "${winners[0].phrase}" get ${Math.round(Math.exp(winners[0].delta) * 100 - 100)}% more engagement` : 'Your top content follows a specific pattern'
    values.POINT_2 = losers[0] ? `"${losers[0].phrase}" kills engagement by ${Math.abs(Math.round(Math.exp(losers[0].delta) * 100 - 100))}%` : 'Certain phrases actively hurt your reach'
    values.POINT_3 = blueprint.common_opener ? `${Math.round((blueprint.common_opener.share || 0) * 100)}% of your winners use ${blueprint.common_opener.label} openers` : 'Your winning posts share a structural pattern'
    values.POINT_4 = `Average winning caption: ${blueprint.avg_length || 200} characters`
    values.POINT_5 = topic ? `The data says: lean into ${topic} content` : 'Double down on what the numbers prove works'
    values.CTA_TEXT = 'Follow for data-driven content strategy'
  }

  if (templateId === 'chris_do_typography') {
    values.STATEMENT = topic || (winners[0]
      ? `The word "${winners[0].phrase}" is worth more than your entire marketing budget.`
      : 'Your content strategy is a math problem disguised as a creative one.')
  }

  if (templateId === 'behind_the_scenes_reel') {
    values.HOOK_LINE = topic ? `Want to see how I create ${topic} content?` : 'Want to see what goes into a viral post?'
    values.PROCESS_DESCRIPTION = 'Researching data, drafting the copy, designing the slides, scheduling the post'
    values.RESULT_REVEAL = topic ? `The finished ${topic} post, ready to go live` : 'The finished post, polished and ready to publish'
  }

  if (templateId === 'value_ladder') {
    values.TOPIC = topic || 'Content Strategy'
    values.LEVEL_1 = 'Post randomly and hope for the best'
    values.LEVEL_2 = 'Follow a consistent schedule'
    values.LEVEL_3 = winners[0] ? `Use proven phrases like "${winners[0].phrase}"` : 'Study what actually gets engagement'
    values.LEVEL_4 = blueprint.common_opener ? `Structure posts with ${blueprint.common_opener.label} openers` : 'Apply structural blueprints from your data'
    values.LEVEL_5 = 'Let the data write the script for you'
    values.CTA_TEXT = 'Save this and start climbing'
  }

  if (templateId === 'before_after') {
    values.BEFORE_STATE = topic ? `Struggling with ${topic} content that gets zero traction` : 'Posting every day with zero engagement growth'
    values.PAIN_POINT = losers[0] ? `Every caption sounded the same. Phrases like "${losers[0].phrase}" were killing my reach.` : 'No clarity on what works. Every post felt like a guess.'
    values.STEP_1 = 'Analysed 50 posts to find the mathematical baseline'
    values.STEP_2 = winners[0] ? `Discovered "${winners[0].phrase}" drives ${Math.round(Math.exp(winners[0].delta) * 100 - 100)}% more engagement` : 'Found the exact phrases my audience responds to'
    values.STEP_3 = 'Built a repeatable template from winning post structure'
    values.AFTER_STATE = 'Engagement doubled. Every post has a data-backed blueprint.'
    values.CTA_TEXT = 'Your data has the same answers. Start looking.'
  }

  if (templateId === 'question_hook') {
    values.QUESTION = topic ? `Why does ${topic} actually work` : 'Why do 93% of carousels underperform'
    values.MYTH_1 = 'It\'s about posting more often'
    values.MYTH_2 = 'You need better photos'
    values.REAL_ANSWER = losers[0] ? `Stop saying "${losers[0].phrase}" -- it statistically kills engagement` : 'The structure matters more than the visuals'
    values.EVIDENCE_1 = winners[0] ? `Posts with "${winners[0].phrase}" outperform by ${Math.round(Math.exp(winners[0].delta) * 100 - 100)}%` : 'Data from 50 posts proves the pattern'
    values.EVIDENCE_2 = 'Mixed-media carousels hit 2.33% ER vs 1.80% for image-only (CreatorsJet 2025)'
    values.TRUTH_BOMB = 'Your content already has the answers. You just need to read the data.'
    values.CTA_TEXT = 'Save this. Share it. Then check your own numbers.'
  }

  return values
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER (fills __FIELD__ placeholders in slide prompts/scripts)
// ─────────────────────────────────────────────────────────────────────────────

function buildFilledSlides(template, values = {}) {
  return template.slides.map((slide, i) => {
    let prompt = slide.prompt
    let script = slide.script || null
    if (prompt) {
      for (const [key, val] of Object.entries(values)) {
        prompt = prompt.replace(new RegExp(`__${key}__`, 'g'), val || `[${key}]`)
      }
    }
    if (script) {
      for (const [key, val] of Object.entries(values)) {
        script = script.replace(new RegExp(`__${key}__`, 'g'), val || `[${key}]`)
      }
    }
    return {
      slide_number: i + 1,
      zone: slide.zone,
      purpose: slide.purpose,
      prompt,
      script,
      needs_image: !!prompt,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT_STUDIO_CACHE_KEY = (h) => `script_studio:v1:${h}`

function loadScriptStudioCache(handle) {
  if (!handle || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SCRIPT_STUDIO_CACHE_KEY(handle))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data) return null
    return data.payload || data
  } catch { return null }
}

/** Convert FIELD_NAME to "Field name" for display. */
function humaniseField(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c, i) => (i === 0 ? c.toUpperCase() : c.toLowerCase()))
}

/** Format badge label from template format + slide_count. */
function formatBadge(template) {
  if (template.format === 'carousel') return `Carousel · ${template.slide_count} slides`
  if (template.format === 'photo') return `Photo · ${template.slide_count} slide`
  if (template.format === 'reel') return 'Reel · Script'
  return template.format
}

/** Icon for template format. */
function FormatIcon({ format, className }) {
  if (format === 'carousel') return <Layers className={className} />
  if (format === 'reel') return <Video className={className} />
  return <ImageIcon className={className} />
}

/** Zone badge colour classes. */
function zoneBadgeClasses(zone) {
  switch (zone) {
    case 'hook':
    case 'hook2':
      return 'bg-amber-100 text-amber-800'
    case 'value':
      return 'bg-teal-100 text-teal-800'
    case 'cta':
      return 'bg-violet-100 text-violet-800'
    case 'retain':
      return 'bg-sky-100 text-sky-800'
    case 'reward':
      return 'bg-emerald-100 text-emerald-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function PaneHeader({ title, subtitle, backLabel, onBack }) {
  return (
    <div className="mb-5">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#64756f] hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {backLabel || 'Back'}
        </button>
      )}
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

function TemplateCard({ template, index, onSelect }) {
  const bgColor = template.style.bg === 'n/a' ? '#374151' : template.style.bg
  return (
    <div
      className={cn(
        'group flex flex-col rounded-2xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-all duration-300',
        'hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.14)] hover:-translate-y-0.5',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both'
      )}
      style={{ animationDelay: `${index * 60}ms`, animationDuration: '400ms' }}
    >
      {/* Colour swatch strip */}
      <div
        className="h-2.5 w-full rounded-t-2xl"
        style={{ backgroundColor: bgColor }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Name + format badge */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold leading-tight text-slate-900">{template.name}</h3>
          <FormatIcon format={template.format} className="h-4 w-4 shrink-0 text-[#64756f]" />
        </div>

        {/* Format badge */}
        <span className="mb-2.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          {formatBadge(template)}
        </span>

        {/* Description */}
        <p className="mb-3 flex-1 text-[13px] leading-relaxed text-[#64756f]">
          {template.description}
        </p>

        {/* Citation */}
        <p className="mb-4 text-[11px] leading-relaxed text-slate-400 italic">
          {template.citation}
        </p>

        {/* CTA */}
        <button
          onClick={() => onSelect(template)}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold transition-all',
            'bg-slate-900 text-white hover:bg-slate-800',
            'group-hover:bg-teal-600 group-hover:shadow-[0_8px_24px_-8px_rgba(20,184,166,0.4)]'
          )}
        >
          Use template <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function GalleryView({ onSelect }) {
  return (
    <>
      <PaneHeader
        title="Template Studio"
        subtitle="Choose a proven content template backed by real engagement data"
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {TEMPLATES.map((t, i) => (
          <TemplateCard key={t.id} template={t} index={i} onSelect={onSelect} />
        ))}
      </div>
    </>
  )
}

function FillView({ template, handle, onBack, onGenerate }) {
  const [fieldValues, setFieldValues] = useState({})
  const [hasAutoFilled, setHasAutoFilled] = useState(false)

  const isReel = template.format === 'reel'

  // Attempt auto-fill on mount
  useEffect(() => {
    const analysis = loadScriptStudioCache(handle)
    if (analysis && analysis.ok) {
      const filled = autoFillFromAnalysis(template.id, analysis)
      if (Object.keys(filled).length > 0) {
        setFieldValues(filled)
        setHasAutoFilled(true)
      }
    }
  }, [template.id, handle])

  const handleFieldChange = useCallback((field, value) => {
    setFieldValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleAutoFill = useCallback(() => {
    const analysis = loadScriptStudioCache(handle)
    if (!analysis || !analysis.ok) return
    const filled = autoFillFromAnalysis(template.id, analysis)
    setFieldValues((prev) => ({ ...prev, ...filled }))
    setHasAutoFilled(true)
  }, [handle, template.id])

  const allFieldsFilled = template.fields.every((f) => fieldValues[f]?.trim())

  const bgColor = template.style.bg === 'n/a' ? '#374151' : template.style.bg

  return (
    <>
      <PaneHeader
        title={template.name}
        subtitle={template.description}
        backLabel="All templates"
        onBack={onBack}
      />

      {/* Template context bar */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: bgColor }} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64756f]">
          {formatBadge(template)}
        </span>
        <span className="text-[11px] text-slate-400">{template.framework}</span>
      </div>

      {/* Fields form */}
      <div className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#64756f]">
              {isReel ? 'Script fields' : 'Slide fields'}
            </div>
            <div className="text-base font-bold">Fill in your content</div>
          </div>
          {handle && (
            <button
              onClick={handleAutoFill}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-colors',
                hasAutoFilled
                  ? 'bg-teal-50 text-teal-700 shadow-[0_0_0_1px_rgba(20,184,166,0.2)]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              {hasAutoFilled ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Auto-filled
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-fill from my data
                </>
              )}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {template.fields.map((field) => {
            const isLong = ['PROCESS_DESCRIPTION', 'STATEMENT', 'PAIN_POINT', 'BEFORE_STATE', 'AFTER_STATE', 'TRUTH_BOMB'].includes(field)
            return (
              <div key={field}>
                <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">
                  {humaniseField(field)}
                </label>
                {isLong ? (
                  <textarea
                    value={fieldValues[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    rows={3}
                    placeholder={`Enter ${humaniseField(field).toLowerCase()}...`}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none transition-colors"
                  />
                ) : (
                  <input
                    type="text"
                    value={fieldValues[field] || ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={`Enter ${humaniseField(field).toLowerCase()}...`}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-colors"
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Reel preview: show script text live */}
        {isReel && Object.keys(fieldValues).length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#64756f]">Script preview</div>
            <div className="space-y-3">
              {template.slides.map((slide, i) => {
                let scriptText = slide.script || ''
                for (const [key, val] of Object.entries(fieldValues)) {
                  scriptText = scriptText.replace(new RegExp(`__${key}__`, 'g'), val || `[${key}]`)
                }
                return (
                  <div key={i} className="rounded-xl bg-slate-50 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', zoneBadgeClasses(slide.zone))}>
                        {slide.zone}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">{slide.purpose}</span>
                    </div>
                    <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800 font-medium">{scriptText}</pre>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Generate CTA */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onBack}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#64756f] hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(template, fieldValues)}
            disabled={!allFieldsFilled}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all',
              allFieldsFilled
                ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-[0_8px_24px_-8px_rgba(20,184,166,0.4)]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            {isReel ? (
              <>
                <PenTool className="h-3.5 w-3.5" />
                Generate script
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate slides
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

function PreviewView({ template, fieldValues, onBack }) {
  const isReel = template.format === 'reel'
  const filledSlides = buildFilledSlides(template, fieldValues)
  const bgColor = template.style.bg === 'n/a' ? '#374151' : template.style.bg
  const textColor = template.style.text === 'n/a' ? '#ffffff' : template.style.text
  const accentColor = template.style.accent === 'n/a' ? '#14b8a6' : template.style.accent

  return (
    <>
      <PaneHeader
        title={`${template.name} — Preview`}
        subtitle={isReel ? 'Your generated script is ready' : `${filledSlides.length} slides generated`}
        backLabel="Edit fields"
        onBack={onBack}
      />

      {/* Reel script output */}
      {isReel && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-bold">{template.name}</div>
                <div className="text-xs text-[#64756f]">15-25 second script in 3 phases</div>
              </div>
            </div>
            <div className="space-y-3">
              {filledSlides.map((slide) => (
                <div key={slide.slide_number} className="rounded-xl bg-slate-50 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-slate-200 text-[11px] font-bold text-slate-700">
                      {slide.slide_number}
                    </span>
                    <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', zoneBadgeClasses(slide.zone))}>
                      {slide.zone}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">{slide.purpose}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800 font-medium">{slide.script}</pre>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              disabled
              className="flex items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-400 cursor-not-allowed"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> Save to templates
            </button>
          </div>
        </div>
      )}

      {/* Carousel / Photo slide preview grid */}
      {!isReel && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filledSlides.map((slide) => (
              <div
                key={slide.slide_number}
                className={cn(
                  'relative flex flex-col justify-between overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.05)]',
                  'aspect-[4/5]',
                  'animate-in fade-in slide-in-from-bottom-2 fill-mode-both'
                )}
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  animationDelay: `${slide.slide_number * 60}ms`,
                  animationDuration: '400ms',
                }}
              >
                {/* Slide number */}
                <div className="flex items-center justify-between p-4">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-lg text-[12px] font-bold"
                    style={{ backgroundColor: accentColor, color: bgColor }}
                  >
                    {slide.slide_number}
                  </span>
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', zoneBadgeClasses(slide.zone))}>
                    {slide.zone}
                  </span>
                </div>

                {/* Purpose + prompt text */}
                <div className="flex-1 px-4">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                    {slide.purpose}
                  </div>
                  <p className="text-[12px] leading-relaxed opacity-80 line-clamp-6">
                    {slide.prompt}
                  </p>
                </div>

                {/* Placeholder watermark */}
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-40">
                    <Sparkles className="h-3 w-3" />
                    Preview placeholder
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              disabled
              className="flex items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-400 cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" /> Download all
            </button>
            <button
              disabled
              className="flex items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-400 cursor-not-allowed"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> Save to templates
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANE
// ─────────────────────────────────────────────────────────────────────────────

export default function TemplateStudioPane({ timeRange }) {
  const { user } = useAuth()

  // State machine: gallery | fill | preview
  const [view, setView] = useState('gallery')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [previewValues, setPreviewValues] = useState(null)

  // Handle from tracked_accounts
  const [handle, setHandle] = useState(null)
  const [handleLoading, setHandleLoading] = useState(true)

  // Resolve tracked handle (same pattern as PulsePane / ScriptStudioPane)
  useEffect(() => {
    if (!user) { setHandleLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('tracked_accounts')
        .select('username')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      setHandleLoading(false)
      if (error || !data) { setHandle(null); return }
      setHandle(data.username)
    })()
    return () => { cancelled = true }
  }, [user])

  // ── View transitions ────────────────────────────────────────────────────

  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template)
    setPreviewValues(null)
    setView('fill')
  }, [])

  const handleBackToGallery = useCallback(() => {
    setSelectedTemplate(null)
    setPreviewValues(null)
    setView('gallery')
  }, [])

  const handleGenerate = useCallback((template, fieldValues) => {
    setPreviewValues(fieldValues)
    setView('preview')
  }, [])

  const handleBackToFill = useCallback(() => {
    setView('fill')
  }, [])

  // ── Loading state ────────────────────────────────────────────────────────

  if (handleLoading) {
    return (
      <>
        <div className="mb-5">
          <Skeleton className="mb-2 h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </>
    )
  }

  // ── Empty state: no tracked account ──────────────────────────────────────

  if (!handle) {
    return (
      <>
        <PaneHeader
          title="Template Studio"
          subtitle="Choose a proven content template backed by real engagement data"
        />
        <div className="rounded-2xl bg-white p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <Layers className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-900">Track an account first</h3>
          <p className="mt-1 text-sm text-[#64756f]">
            Add an Instagram account in your dashboard to unlock Template Studio.
            Templates can auto-fill from your Script Studio data.
          </p>
        </div>
      </>
    )
  }

  // ── Route to active view ─────────────────────────────────────────────────

  if (view === 'fill' && selectedTemplate) {
    return (
      <FillView
        template={selectedTemplate}
        handle={handle}
        onBack={handleBackToGallery}
        onGenerate={handleGenerate}
      />
    )
  }

  if (view === 'preview' && selectedTemplate && previewValues) {
    return (
      <PreviewView
        template={selectedTemplate}
        fieldValues={previewValues}
        onBack={handleBackToFill}
      />
    )
  }

  // Default: gallery
  return <GalleryView onSelect={handleSelectTemplate} />
}
