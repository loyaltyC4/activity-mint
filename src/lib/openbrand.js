// src/lib/openbrand.js — Brand visual identity via Brandfetch
//
// extractBrandFromUrl(url) -> { colors: [hex...], fonts: [name...], logo, name, description }
// Consumed by src/lib/brand-dna.js Layer 2 (visual identity). Domain-based:
// feed it a website and Brandfetch returns the brand's palette, fonts and logo.
//
// Requires env: BRANDFETCH_API_KEY (Brandfetch Brand API key).

const SOCIAL = {
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'youtube.com': 'youtube',
  'x.com': 'x',
  'twitter.com': 'x',
  'linkedin.com': 'linkedin',
  'pinterest.com': 'pinterest',
  'threads.net': 'threads',
}

function toDomain(input) {
  const s = String(input || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return s.split('/')[0].toLowerCase()
}

/**
 * Classify a single free-text input as a website vs a social handle.
 * Used by the onboarding form to route into websiteUrl (Brandfetch) or handle (Hetzner cluster).
 *
 * @returns {{type:'website',url,domain} | {type:'social',platform,handle} | {type:'name',query} | {type:'empty'}}
 */
export function classifyBrandInput(raw) {
  const q = String(raw || '').trim()
  if (!q) return { type: 'empty' }
  const s = q.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const host = s.split('/')[0].toLowerCase()

  // explicit social-network URL -> social (never treat as the brand's own domain)
  for (const d in SOCIAL) {
    if (host === d || host.endsWith('.' + d)) {
      const handle = d === 'linkedin.com'
        ? ((s.match(/linkedin\.com\/(?:company|in|school)\/([^/?#]+)/i) || [])[1] || '')
        : s.split('/').slice(1).join('/').replace(/^@/, '').split(/[/?#]/)[0]
      return { type: 'social', platform: SOCIAL[d], handle }
    }
  }
  // leading @ -> social handle (default Instagram)
  if (q[0] === '@') return { type: 'social', platform: 'instagram', handle: q.slice(1).split(/[/?#\s]/)[0] }
  // looks like a real domain/website -> website
  if (!/\s/.test(s) && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+(?:\/.*)?$/i.test(s)) {
    return { type: 'website', url: 'https://' + s, domain: host }
  }
  // otherwise a bare brand name
  return { type: 'name', query: q }
}

/**
 * Extract a brand's visual identity from a website URL via Brandfetch.
 * @param {string} url  website URL or domain
 * @returns {Promise<{colors:string[], fonts:string[], logo:(string|null), name:string, description:string}>}
 */
export async function extractBrandFromUrl(url) {
  const KEY = process.env.BRANDFETCH_API_KEY
  if (!KEY) throw new Error('BRANDFETCH_API_KEY not set')

  const domain = toDomain(url)
  if (!domain || SOCIAL[domain]) throw new Error('not a brand domain: ' + domain)

  const res = await fetch('https://api.brandfetch.io/v2/brands/' + encodeURIComponent(domain), {
    headers: { Authorization: 'Bearer ' + KEY },
  })
  if (!res.ok) throw new Error('brandfetch HTTP ' + res.status)
  const d = await res.json()

  // colors ordered brand, accent, dark, light, then the rest
  const order = { brand: 0, accent: 1, dark: 2, light: 3 }
  const colors = (d.colors || [])
    .slice()
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))
    .map((c) => c.hex)
    .filter(Boolean)

  const fonts = []
  const title = (d.fonts || []).find((f) => f.type === 'title')
  if (title) fonts.push(title.name)
  const body = (d.fonts || []).find((f) => f.type === 'body')
  if (body) fonts.push(body.name)

  const pick = (t) => {
    const L = (d.logos || []).find((l) => l.type === t)
    if (!L) return null
    const fmts = L.formats || []
    const f = fmts.find((x) => x.format === 'png') || fmts.find((x) => x.format === 'svg') || fmts[0]
    return f ? f.src : null
  }
  const logo = pick('logo') || pick('symbol') || pick('icon')

  return {
    colors,
    fonts,
    logo,
    name: d.name || domain,
    description: d.description || d.longDescription || '',
  }
}

export default { extractBrandFromUrl, classifyBrandInput }
