/**
 * ChatPanel — SSE streaming chat interface for the carousel AI agent.
 *
 * Claude operates autonomously: given a topic it creates a full carousel
 * by firing create_slide / update_slide / delete_slide / save_caption tools.
 * Each tool execution emits a typed SSE event that this component handles
 * and forwards to the parent via callbacks so the UI updates in real time.
 *
 * SSE events consumed:
 *   token         → append text to current assistant message
 *   tool_start    → show "Creating slide…" indicator
 *   slide_created → notify parent, show confirmation chip
 *   slide_updated → notify parent, show confirmation chip
 *   slide_deleted → notify parent, show confirmation chip
 *   caption_saved → notify parent, show confirmation chip
 *   done          → mark message complete, re-enable input
 *   error         → show error in chat
 */
'use strict'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, CheckCircle2, RefreshCw, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Suggestion chips shown before first message
const SUGGESTIONS = [
  'Create a 5-slide carousel about growing on Instagram',
  'Make a "3 mistakes founders make" carousel',
  'Build a before/after transformation carousel',
  'Write a stat-shock carousel about social media ROI',
]

export default function ChatPanel({
  carouselId,
  brandDNA,
  onSlideCreated,
  onSlideUpdated,
  onSlideDeleted,
  onCaptionSaved,
  className = '',
}) {
  const [messages, setMessages]     = useState([])     // { role, content, type?, chips? }
  const [input, setInput]           = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [activeToolLabel, setActiveToolLabel] = useState(null)

  const inputRef    = useRef(null)
  const bottomRef   = useRef(null)
  const readerRef   = useRef(null)

  // Auto-scroll to bottom when messages or streaming text changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Build conversation history for the API (exclude tool-chip messages)
  const apiHistory = messages
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
    .map(m => ({ role: m.role, content: m.content }))

  function toolLabel(toolName) {
    const labels = {
      create_slide: '⚡ Creating slide…',
      update_slide: '✏️ Updating slide…',
      delete_slide: '🗑️ Deleting slide…',
      save_caption: '📝 Saving caption…',
    }
    return labels[toolName] || `Running ${toolName}…`
  }

  function toolDoneChip(event) {
    switch (event.type) {
      case 'slide_created':
        return { label: `✓ Slide ${(event.slide?.slide_order ?? 0) + 1} created`, color: 'positive' }
      case 'slide_updated':
        return { label: `✓ Slide ${(event.slide?.slide_order ?? 0) + 1} updated`, color: 'brand' }
      case 'slide_deleted':
        return { label: '✓ Slide deleted', color: 'amber' }
      case 'caption_saved':
        return { label: '✓ Caption saved', color: 'positive' }
      default:
        return null
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    // Add user message to UI
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    setIsStreaming(true)
    setStreamingText('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const response = await fetch('/api/carousel/chat', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          carouselId,
          message:  trimmed,
          messages: apiHistory,
          brandDNA,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buf = ''
      let assistantContent = ''
      let chips = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() // keep incomplete line for next chunk

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event
          try { event = JSON.parse(line.slice(6)) } catch { continue }

          switch (event.type) {
            case 'token':
              assistantContent += event.text
              setStreamingText(assistantContent)
              break

            case 'tool_start':
              setActiveToolLabel(toolLabel(event.tool))
              break

            case 'slide_created':
              setActiveToolLabel(null)
              onSlideCreated?.(event.slide)
              chips.push(toolDoneChip(event))
              break

            case 'slide_updated':
              setActiveToolLabel(null)
              onSlideUpdated?.(event.slide)
              chips.push(toolDoneChip(event))
              break

            case 'slide_deleted':
              setActiveToolLabel(null)
              onSlideDeleted?.(event.slideId)
              chips.push(toolDoneChip(event))
              break

            case 'caption_saved':
              setActiveToolLabel(null)
              onCaptionSaved?.(event.data)
              chips.push(toolDoneChip(event))
              break

            case 'done':
              // Commit the fully streamed message + any action chips
              setMessages(prev => [
                ...prev,
                {
                  role:    'assistant',
                  content: assistantContent,
                  chips:   chips.filter(Boolean),
                },
              ])
              setStreamingText('')
              setActiveToolLabel(null)
              setIsStreaming(false)
              inputRef.current?.focus()
              return

            case 'error':
              throw new Error(event.message || 'Stream error')
          }
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: null, error: err.message },
      ])
      setStreamingText('')
      setActiveToolLabel(null)
      setIsStreaming(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function cancelStream() {
    try { readerRef.current?.cancel() } catch {}
    setIsStreaming(false)
    setStreamingText('')
    setActiveToolLabel(null)
  }

  const chipColors = {
    positive: 'bg-positive/10 text-positive',
    brand:    'bg-brand-soft text-brand-ink',
    amber:    'bg-amber/10 text-amber',
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-hairline flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-gradient-to-br from-brand to-brand-ink grid place-items-center">
            <Sparkles className="size-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-display font-semibold tracking-tight">AI Designer</span>
        </div>
        {isStreaming && (
          <button
            onClick={cancelStream}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-negative transition-colors"
          >
            <RefreshCw className="size-3" strokeWidth={2} />
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {/* Empty state: suggestion chips */}
        {messages.length === 0 && !isStreaming && (
          <div className="space-y-2 pt-4">
            <p className="text-xs text-muted-foreground text-center mb-4">
              Give Claude a topic and it will build the entire carousel for you.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="w-full text-left text-xs p-3 rounded-xl ring-1 ring-foreground/[0.06] bg-surface-2/50 hover:bg-brand-soft hover:ring-brand/30 hover:text-brand-ink transition-all leading-relaxed"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Message thread */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-foreground text-white text-sm leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[95%] space-y-2">
                {msg.error ? (
                  <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-negative/10 text-negative text-sm">
                    Error: {msg.error}
                  </div>
                ) : msg.content ? (
                  <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-surface-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : null}

                {/* Tool result chips */}
                {msg.chips?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {msg.chips.map((chip, ci) => (
                      <span
                        key={ci}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${chipColors[chip.color] || chipColors.brand}`}
                      >
                        <CheckCircle2 className="size-2.5" strokeWidth={2.5} />
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Streaming message in progress */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[95%] space-y-2">
              {streamingText && (
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-surface-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingText}
                  <span className="inline-block size-1.5 rounded-full bg-brand ml-0.5 animate-pulse" />
                </div>
              )}
              {activeToolLabel && (
                <div className="flex items-center gap-1.5 pl-1">
                  <Loader2 className="size-3 text-brand animate-spin" strokeWidth={2} />
                  <span className="text-[11px] font-mono text-muted-foreground">{activeToolLabel}</span>
                </div>
              )}
              {!streamingText && !activeToolLabel && (
                <div className="flex items-center gap-1.5 pl-1 py-1">
                  <Loader2 className="size-3 text-brand animate-spin" strokeWidth={2} />
                  <span className="text-[11px] font-mono text-muted-foreground">Thinking…</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-hairline shrink-0">
        <div className="flex items-end gap-2 p-2 rounded-xl ring-1 ring-foreground/[0.08] bg-surface-2/50 focus-within:ring-brand transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              // Auto-resize
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Topic, tweak, or instruction…"
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[120px] leading-6 disabled:opacity-50"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="size-7 rounded-lg grid place-items-center bg-brand text-foreground hover:bg-brand/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
