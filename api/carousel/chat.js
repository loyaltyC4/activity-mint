/**
 * api/carousel/chat.js — Vercel Serverless Function
 *
 * POST /api/carousel/chat
 *
 * The carousel AI engine. Claude operates as an autonomous slide-creation
 * agent — it PROACTIVELY creates, updates and deletes slides rather than
 * waiting for permission. This is the core UX: user gives a topic, Claude
 * produces a complete carousel slide by slide while the user watches.
 *
 * Architecture (adapted from open-carrusel, subprocess → SDK tool_use):
 *   - Instead of spawn('claude', ['--allowedTools', 'Bash']) + curl,
 *     Claude is given 4 typed tools: create_slide, update_slide,
 *     delete_slide, save_caption.
 *   - When Claude calls a tool, this route executes the Supabase operation
 *     and emits a custom SSE event so the client can update the UI in
 *     real time — no polling needed.
 *   - Agentic loop: if stop_reason === 'tool_use', provide results and
 *     continue streaming until stop_reason === 'end_turn'.
 *
 * SSE event types emitted to client:
 *   { type: 'token',       text: string }            streaming text token
 *   { type: 'tool_start',  tool: string, input: {} } Claude called a tool
 *   { type: 'slide_created', slide: Slide }          create_slide result
 *   { type: 'slide_updated', slide: Slide }          update_slide result
 *   { type: 'slide_deleted', slideId: string }       delete_slide result
 *   { type: 'caption_saved', data: {} }              save_caption result
 *   { type: 'done' }                                 stream complete
 *   { type: 'error', message: string }               error occurred
 *
 * Body: {
 *   carouselId:  string
 *   message:     string           — user's current message
 *   messages?:   Message[]        — prior conversation history (optional)
 *   brandDNA?:   BrandDNA         — from Supabase brand_dna table (optional — fetched if absent)
 * }
 *
 * vercel.json: set "maxDuration": 300 for this function on Vercel Pro.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getUserClient } from '../_supabase.js'

export const config = { maxDuration: 300 }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MAX_SLIDES = 20

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function getCarouselWithSlides(db, carouselId, userId) {
  const { data, error } = await db
    .from('carousels')
    .select(`
      id, name, aspect_ratio, template, caption, hashtags,
      slides ( id, slide_order, html, headline, notes )
    `)
    .eq('id', carouselId)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  if (data.slides) data.slides.sort((a, b) => a.slide_order - b.slide_order)
  return data
}

function extractHeadline(html) {
  const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
  if (h) return h[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
  const t = html.match(/>([^<]{4,80})<\//)
  return t ? t[1].trim().slice(0, 80) : ''
}

// ─── Tool execution ───────────────────────────────────────────────────────────

async function createSlide(db, carouselId, { html, notes = '' }) {
  const { count } = await db
    .from('slides')
    .select('id', { count: 'exact', head: true })
    .eq('carousel_id', carouselId)

  if ((count || 0) >= MAX_SLIDES) {
    return { error: `Carousel already has ${MAX_SLIDES} slides (maximum). Use update_slide to refine existing slides.` }
  }

  const { data, error } = await db
    .from('slides')
    .insert({
      carousel_id:  carouselId,
      html:         html.trim(),
      slide_order:  count || 0,
      notes:        notes || '',
      headline:     extractHeadline(html),
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await db
    .from('carousels')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', carouselId)

  return { slide: data }
}

async function updateSlide(db, carouselId, { slideId, html, notes }) {
  if (!slideId) return { error: 'slideId is required' }
  if (!html)    return { error: 'html is required' }

  const { data: current } = await db
    .from('slides')
    .select('html, previous_versions')
    .eq('id', slideId)
    .eq('carousel_id', carouselId)
    .single()

  if (!current) return { error: `Slide ${slideId} not found` }

  const previousVersions = [...(current.previous_versions || [])]
  if (current.html && current.html !== html.trim()) {
    previousVersions.push(current.html)
    if (previousVersions.length > 5) previousVersions.shift()
  }

  const updates = {
    html:              html.trim(),
    previous_versions: previousVersions,
    headline:          extractHeadline(html),
  }
  if (notes !== undefined) updates.notes = notes

  const { data, error } = await db
    .from('slides')
    .update(updates)
    .eq('id', slideId)
    .eq('carousel_id', carouselId)
    .select()
    .single()

  if (error) return { error: error.message }

  await db
    .from('carousels')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', carouselId)

  return { slide: data }
}

async function deleteSlide(db, carouselId, { slideId }) {
  if (!slideId) return { error: 'slideId is required' }

  const { data: slide } = await db
    .from('slides')
    .select('slide_order')
    .eq('id', slideId)
    .eq('carousel_id', carouselId)
    .single()

  if (!slide) return { error: `Slide ${slideId} not found` }

  const { error } = await db
    .from('slides')
    .delete()
    .eq('id', slideId)

  if (error) return { error: error.message }

  // Re-order remaining slides
  const { data: remaining } = await db
    .from('slides')
    .select('id, slide_order')
    .eq('carousel_id', carouselId)
    .gt('slide_order', slide.slide_order)
    .order('slide_order', { ascending: true })

  if (remaining?.length > 0) {
    await Promise.all(
      remaining.map(s =>
        db.from('slides').update({ slide_order: s.slide_order - 1 }).eq('id', s.id)
      )
    )
  }

  await db
    .from('carousels')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', carouselId)

  return { deleted: slideId }
}

async function saveCaption(db, carouselId, userId, { caption, hashtags }) {
  if (!caption) return { error: 'caption is required' }

  const { data, error } = await db
    .from('carousels')
    .update({
      caption:    caption.trim(),
      hashtags:   (hashtags || []).map(h => h.replace(/^#/, '').trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    })
    .eq('id', carouselId)
    .eq('user_id', userId)
    .select('id, caption, hashtags')
    .single()

  if (error) return { error: error.message }
  return { captionSaved: true, data }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'create_slide',
    description: 'Create a new slide in the carousel. Slides are body-level HTML only — no <!DOCTYPE>, <html>, <head>, or <body> tags. Use inline styles or <style> tags. Font-family declarations auto-load from Google Fonts.',
    input_schema: {
      type: 'object',
      properties: {
        html:  { type: 'string', description: 'Complete body-level HTML for the slide. Must fill the full canvas.' },
        notes: { type: 'string', description: 'Brief description of this slide for the filmstrip (1 sentence).' },
      },
      required: ['html'],
    },
  },
  {
    name: 'update_slide',
    description: 'Update an existing slide. The previous version is saved automatically for undo.',
    input_schema: {
      type: 'object',
      properties: {
        slideId: { type: 'string', description: 'The id of the slide to update.' },
        html:    { type: 'string', description: 'New body-level HTML for the slide.' },
        notes:   { type: 'string', description: 'Updated description (optional).' },
      },
      required: ['slideId', 'html'],
    },
  },
  {
    name: 'delete_slide',
    description: 'Delete a slide from the carousel. Remaining slides are re-ordered automatically.',
    input_schema: {
      type: 'object',
      properties: {
        slideId: { type: 'string', description: 'The id of the slide to delete.' },
      },
      required: ['slideId'],
    },
  },
  {
    name: 'save_caption',
    description: 'Save the Instagram caption and hashtags for this carousel.',
    input_schema: {
      type: 'object',
      properties: {
        caption:  { type: 'string', description: 'Instagram caption (150-300 chars). Hook line first, then value, then CTA.' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Array of hashtags without the # prefix. Include 15-20 tags mixing niche, mid-tier, and broad.' },
      },
      required: ['caption', 'hashtags'],
    },
  },
]

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(brandDNA, carousel) {
  const { width, height } = {
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
    '9:16': { width: 1080, height: 1920 },
  }[carousel?.aspect_ratio || '4:5']

  const slideList = carousel?.slides?.length > 0
    ? carousel.slides.map(s =>
        `  - Slide ${s.slide_order + 1} (id: ${s.id}): ${s.notes || s.headline || '(no description)'}`
      ).join('\n')
    : '  (no slides yet — start creating)'

  // Brand section — adapts open-carrusel's BrandConfig to Activity Mint's BrandDNA
  const brandSection = brandDNA
    ? `## Brand identity
- Handle: @${brandDNA.handle}
- Niche: ${brandDNA.niche} | Goal: ${brandDNA.goal}
- Primary: ${brandDNA.primaryColor} | Secondary: ${brandDNA.secondaryColor} | Accent: ${brandDNA.accentColor}
- Background: ${brandDNA.backgroundColor} | Surface: ${brandDNA.surfaceColor}
- Heading font: "${brandDNA.headingFont}" | Body font: "${brandDNA.bodyFont}"
- Voice: ${brandDNA.voice?.tone || 'conversational'}, ${brandDNA.voice?.formality || 3}/5 formality, ${brandDNA.voice?.energy || 'medium'} energy
- Personality: ${(brandDNA.voice?.personality || []).join(', ')}
- Emoji density: ${brandDNA.voice?.emojiDensity || 'light'}
- Top hooks: ${(brandDNA.topHooks || []).join(' | ')}
- Audience pain points: ${(brandDNA.audiencePains || []).join(' | ')}
- Best post formats: ${(brandDNA.topFormats || []).join(', ')}`
    : `## Brand not configured
Use professional defaults: dark text on white backgrounds, Inter font, clean minimal style.`

  const carouselSection = `## Current carousel
- ID: ${carousel?.id || 'unknown'}
- Name: "${carousel?.name || 'Untitled'}"
- Aspect ratio: ${carousel?.aspect_ratio || '4:5'} (${width}×${height}px)
- Slides: ${carousel?.slides?.length || 0}/${MAX_SLIDES}
${slideList}`

  return `You are the AI carousel engine for Activity Mint. You create stunning Instagram carousels AUTONOMOUSLY and PROACTIVELY — don't wait for permission, just create.

${brandSection}

${carouselSection}

## AUTONOMOUS MODE — How you work

### When the user gives you a TOPIC or IDEA:
1. Immediately start creating slides — don't ask clarifying questions first
2. Plan a 5-8 slide narrative arc:
   - Slide 1: HOOK — provocative question, bold stat, or contrarian claim (max 8 words, huge text, full-bleed)
   - Slides 2-3: Setup — establish the problem or context
   - Slides 4-6: Value — one key insight per slide, punchy
   - Slide 7: Summary or transformation reveal
   - Slide 8: CTA — "Follow for more", "Save this", "Share with someone who needs this"
3. Create each slide via the create_slide tool, one at a time
4. After all slides, call save_caption with a strong caption + 20 hashtags

### When the user says "fix slide X" or "improve the hook":
1. Get the slide id from the carousel context above
2. Rewrite the HTML and call update_slide immediately

### When the user says "start over" or "delete all":
1. Call delete_slide for each slide id listed above
2. Then start fresh

## Slide HTML rules (CRITICAL — read before every slide)

Each slide is BODY-LEVEL HTML only. Never output <!DOCTYPE>, <html>, <head>, or <body> tags.

1. Inline <style> tags or style="" attributes only — no external CSS
2. font-family declarations auto-load Google Fonts (e.g. font-family: 'Playfair Display', serif)
3. Exact canvas: ${width}×${height}px — fill the entire space
4. NO JavaScript — the iframe sandbox blocks it
5. Flexbox or grid for layout, position:absolute for overlays
6. Brand defaults: heading="${brandDNA?.headingFont || 'Inter'}", body="${brandDNA?.bodyFont || 'Inter'}", primary=${brandDNA?.primaryColor || '#1a1a2e'}, accent=${brandDNA?.accentColor || '#e94560'}, bg=${brandDNA?.backgroundColor || '#ffffff'}

## Design intelligence

### Typography scale
- Hook/hero slides: 64-96px bold heading, max 8 words, single focal point
- Content slides: 36-48px heading, 22-28px body text
- Max 2 font families per carousel
- Line height: 1.2 for headings, 1.55 for body

### Color & contrast
- Text on background contrast > 4.5:1 always
- Use brand palette: primary for headings, accent for highlights, bg for backgrounds
- Gradients add depth: background: linear-gradient(135deg, ${brandDNA?.primaryColor || '#1a1a2e'}, ${brandDNA?.secondaryColor || '#16213e'})
- Vary backgrounds between slides to maintain visual rhythm

### Layout
- 60-80px padding minimum on all sides
- One clear message per slide — split if needed
- Design for mobile: thumb-stop scroll, high contrast
- Keep critical content in center 80% of the canvas (grid crop awareness)

### Hook optimization
When improving slide 1:
Generate 3 variants: question hook, statistic hook, bold-statement hook.
Call update_slide with the strongest variant, mention the other 2 in your response.

## Behavioral rules
- BE PROACTIVE: create first, explain after. One sentence per slide after creating it.
- BRAND CONSISTENCY: use the brand colors and fonts on every slide
- VISUAL VARIETY: change layout and background treatment between slides
- ALWAYS END WITH CTA: last slide always has a clear call-to-action
- FONT WHITELIST: Inter, Playfair Display, Space Grotesk, DM Sans, Merriweather (Google Fonts only)`
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await getUserClient(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })
  const { user, db } = auth

  const { carouselId, message, messages: priorHistory = [], brandDNA: clientBrandDNA } = req.body || {}

  if (!carouselId) return res.status(400).json({ error: 'carouselId is required' })
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }

  // Fetch carousel with current slides so Claude knows the state
  const carousel = await getCarouselWithSlides(db, carouselId, user.id)
  if (!carousel) return res.status(404).json({ error: 'Carousel not found' })

  // Use brandDNA from client if provided, else fetch from Supabase
  let brandDNA = clientBrandDNA || null
  if (!brandDNA) {
    const { data } = await db
      .from('brand_dna')
      .select('*')
      .eq('user_id', user.id)
      .order('extracted_at', { ascending: false })
      .limit(1)
      .single()
    brandDNA = data
  }

  const systemPrompt = buildSystemPrompt(brandDNA, carousel)

  // Build message history: prior turns + new user message
  const messages = [
    ...priorHistory.filter(m => m.role && m.content),
    { role: 'user', content: message.trim() },
  ]

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      function emit(obj) {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        } catch { isClosed = true }
      }

      async function executeToolCall(toolName, toolInput) {
        emit({ type: 'tool_start', tool: toolName, input: toolInput })

        let result
        switch (toolName) {
          case 'create_slide':
            result = await createSlide(db, carouselId, toolInput)
            if (result.slide) emit({ type: 'slide_created', slide: result.slide })
            break
          case 'update_slide':
            result = await updateSlide(db, carouselId, toolInput)
            if (result.slide) emit({ type: 'slide_updated', slide: result.slide })
            break
          case 'delete_slide':
            result = await deleteSlide(db, carouselId, toolInput)
            if (result.deleted) emit({ type: 'slide_deleted', slideId: result.deleted })
            break
          case 'save_caption':
            result = await saveCaption(db, carouselId, user.id, toolInput)
            if (result.captionSaved) emit({ type: 'caption_saved', data: result.data })
            break
          default:
            result = { error: `Unknown tool: ${toolName}` }
        }
        return result
      }

      try {
        // ── Agentic loop ──────────────────────────────────────────────────
        // Continue until Claude stops calling tools (end_turn) or an error.
        let currentMessages = messages

        while (true) {
          const sdkStream = anthropic.messages.stream({
            model:      'claude-sonnet-4-6',
            max_tokens: 8096,
            system:     systemPrompt,
            tools:      TOOLS,
            messages:   currentMessages,
          })

          // Stream text tokens to the client as they arrive
          sdkStream.on('text', text => emit({ type: 'token', text }))

          const finalMessage = await sdkStream.finalMessage()

          if (finalMessage.stop_reason === 'end_turn') {
            // Claude finished — no tool calls pending
            break
          }

          if (finalMessage.stop_reason === 'tool_use') {
            // Add Claude's response to history
            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: finalMessage.content },
            ]

            // Execute each tool call and collect results
            const toolResults = []
            for (const block of finalMessage.content) {
              if (block.type !== 'tool_use') continue
              const result = await executeToolCall(block.name, block.input)
              toolResults.push({
                type:        'tool_result',
                tool_use_id: block.id,
                content:     JSON.stringify(result),
              })
            }

            // Provide results back to Claude and continue the loop
            currentMessages = [
              ...currentMessages,
              { role: 'user', content: toolResults },
            ]
            continue
          }

          // Any other stop reason (max_tokens, stop_sequence) — break
          break
        }

        emit({ type: 'done' })
      } catch (err) {
        emit({ type: 'error', message: err.message || 'Stream error' })
        console.error('[carousel/chat] stream error:', err)
      } finally {
        isClosed = true
        try { controller.close() } catch {}
      }
    },

    cancel() { isClosed = true },
  })

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  } finally {
    res.end()
  }
}
