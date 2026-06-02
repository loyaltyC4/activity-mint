/**
 * ExportButton — triggers the Hetzner Playwright export pipeline.
 *
 * Flow: POST /api/carousel/export → poll response → trigger ZIP download.
 * The export API is synchronous (returns when done) so no polling loop needed —
 * we just wait for the fetch to resolve and then trigger a download anchor.
 */
'use strict'

import React, { useState } from 'react'
import { Download, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATES = {
  idle:      { label: 'Export PNG',      icon: Download,      cls: '' },
  loading:   { label: 'Exporting…',      icon: Loader2,       cls: 'opacity-75 cursor-not-allowed' },
  done:      { label: 'Downloaded!',     icon: CheckCircle2,  cls: 'bg-positive text-white hover:bg-positive/90' },
}

export default function ExportButton({ carouselId, slideCount = 0 }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleExport() {
    if (status === 'loading' || slideCount === 0) return
    setStatus('loading')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/carousel/export', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ carouselId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Export failed (HTTP ${res.status})`)
      }

      const { exportUrl } = await res.json()
      if (!exportUrl) throw new Error('No export URL returned')

      // Trigger browser download
      const a = document.createElement('a')
      a.href = exportUrl
      a.download = `carousel-${carouselId.slice(0, 8)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      setStatus('done')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  const { label, icon: Icon, cls } = STATES[status]

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleExport}
        disabled={status === 'loading' || slideCount === 0}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-all ${cls} disabled:opacity-50 disabled:cursor-not-allowed`}
        title={slideCount === 0 ? 'Add slides first' : `Export ${slideCount} slide${slideCount !== 1 ? 's' : ''} as PNG ZIP`}
      >
        <Icon className={`size-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} strokeWidth={2.25} />
        {label}
      </button>
      {error && (
        <span className="text-[10px] text-negative font-mono max-w-[200px] text-right">{error}</span>
      )}
    </div>
  )
}
