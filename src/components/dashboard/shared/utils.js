/**
 * Small shared helpers for dashboard cards.
 *
 * proxyImg: Instagram CDN URLs (scontent.cdninstagram.com, fbcdn.net) can't
 * be loaded directly by the browser — their signed URLs require Instagram's
 * referer + auth. Route them through /api/proxy-image to add the right
 * server-side headers.
 */

'use strict'

export function proxyImg(url) {
  if (!url || typeof url !== 'string') return null
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net') || url.includes('scontent')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`
  }
  return url
}

export function fmt(n) {
  if (n === null || n === undefined) return '--'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}
