/**
 * Brand Extraction — deterministic brand signal analysis from profile + posts.
 *
 * Zero AI tokens. Computes brand voice, content pillars, visual style,
 * and audience depth entirely from the data already fetched. The AI
 * synthesis layer is OPTIONAL (called separately via ai-insights).
 *
 * Returns a brand profile that renders instantly in the Pulse pane.
 */

// ─── Voice detection ──────────────────────────────────────────────────────
const VOICE_MARKERS = {
  educational: {
    patterns: /\b(how to|step|learn|tip|guide|tutorial|lesson|strategy|framework|method|hack|secret)\b/i,
    label: 'Educational',
    color: 'bg-teal-50 text-teal-700',
    description: 'Teaches and explains — your audience comes to learn',
  },
  provocative: {
    patterns: /^(stop|don't|never|why do|why does|everything you know|you're doing .* wrong|the truth|nobody tells)/im,
    label: 'Provocative',
    color: 'bg-rose-50 text-rose-700',
    description: 'Challenges assumptions — your audience comes for the truth bombs',
  },
  inspirational: {
    patterns: /\b(dream|believe|journey|transform|growth|mindset|grateful|blessed|manifest|goals|vision)\b/i,
    label: 'Inspirational',
    color: 'bg-violet-50 text-violet-700',
    description: 'Motivates and uplifts — your audience comes for energy',
  },
  casual: {
    patterns: /\b(lol|haha|ngl|tbh|literally|vibes|vibe|lowkey|highkey|fr|no cap|bet|imo)\b/i,
    label: 'Casual',
    color: 'bg-amber-50 text-amber-700',
    description: 'Conversational and relatable — your audience feels like a friend',
  },
  professional: {
    patterns: /\b(revenue|roi|kpi|quarterly|stakeholder|strategy|deliverable|optimize|analytics|pipeline|b2b|saas)\b/i,
    label: 'Professional',
    color: 'bg-slate-100 text-slate-700',
    description: 'Business-focused — your audience is here for results',
  },
  storyteller: {
    patterns: /\b(once upon|i remember|the day|that moment|years ago|back when|my story|looking back|i was)\b/i,
    label: 'Storyteller',
    color: 'bg-sky-50 text-sky-700',
    description: 'Narrative-driven — your audience stays for the story arc',
  },
}

function detectVoice(captions) {
  if (!captions || captions.length === 0) return { id: 'unknown', label: 'Not enough data', color: 'bg-slate-100 text-slate-500', description: 'Post more to detect your voice', score: 0 }
  const allText = captions.join('\n')
  const scores = {}
  for (const [id, v] of Object.entries(VOICE_MARKERS)) {
    const matches = allText.match(new RegExp(v.patterns.source, 'gim'))
    scores[id] = matches ? matches.length : 0
  }
  const top = Object.entries(scores).sort(([, a], [, b]) => b - a)
  if (top[0][1] === 0) return { id: 'neutral', label: 'Neutral', color: 'bg-slate-100 text-slate-600', description: 'Balanced tone — no dominant voice pattern', score: 0 }
  const winner = top[0]
  const meta = VOICE_MARKERS[winner[0]]
  return { id: winner[0], label: meta.label, color: meta.color, description: meta.description, score: winner[1] }
}

// ─── Content pillars (theme clustering) ───────────────────────────────────
const THEME_MAP = {
  tech: { keywords: ['tech', 'code', 'developer', 'software', 'ai', 'startup', 'programming', 'app', 'saas', 'web', 'data', 'crypto'], label: 'Tech' },
  fitness: { keywords: ['fitness', 'gym', 'workout', 'health', 'nutrition', 'training', 'muscle', 'yoga', 'run', 'cardio', 'gains'], label: 'Fitness' },
  business: { keywords: ['business', 'entrepreneur', 'marketing', 'sales', 'revenue', 'founder', 'ceo', 'branding', 'money', 'invest', 'finance'], label: 'Business' },
  travel: { keywords: ['travel', 'adventure', 'explore', 'destination', 'wanderlust', 'trip', 'vacation', 'flight', 'hotel', 'culture'], label: 'Travel' },
  food: { keywords: ['food', 'recipe', 'cooking', 'restaurant', 'chef', 'meal', 'delicious', 'eat', 'kitchen', 'taste', 'cuisine'], label: 'Food' },
  beauty: { keywords: ['beauty', 'skincare', 'makeup', 'fashion', 'style', 'outfit', 'trend', 'hair', 'glow', 'aesthetic'], label: 'Beauty' },
  education: { keywords: ['education', 'learn', 'teach', 'student', 'course', 'knowledge', 'study', 'school', 'degree', 'mentor'], label: 'Education' },
  lifestyle: { keywords: ['lifestyle', 'daily', 'routine', 'home', 'family', 'life', 'morning', 'self', 'wellness', 'balance'], label: 'Lifestyle' },
  creative: { keywords: ['art', 'design', 'creative', 'photography', 'music', 'film', 'draw', 'paint', 'illustration', 'visual'], label: 'Creative' },
  entertainment: { keywords: ['funny', 'comedy', 'meme', 'laugh', 'viral', 'trend', 'challenge', 'react', 'prank', 'skit'], label: 'Entertainment' },
}

function detectPillars(hashtags, captions) {
  const allText = [...(hashtags || []), ...(captions || []).map(c => c.toLowerCase())].join(' ')
  const scores = {}
  for (const [id, theme] of Object.entries(THEME_MAP)) {
    let count = 0
    for (const kw of theme.keywords) {
      const re = new RegExp(`\\b${kw}\\b`, 'gi')
      const m = allText.match(re)
      if (m) count += m.length
    }
    if (count > 0) scores[id] = { ...theme, count }
  }
  const ranked = Object.entries(scores)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 4)
    .map(([id, v]) => ({ id, label: v.label, count: v.count }))
  return ranked
}

// ─── Visual style detection ───────────────────────────────────────────────
function detectVisualStyle(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return { dominant: 'unknown', mix: {}, recommendation: '' }
  const counts = { photo: 0, video: 0, carousel: 0 }
  for (const p of posts) {
    const t = (p.type || 'Image').toLowerCase()
    if (t === 'sidecar' || t === 'carousel') counts.carousel++
    else if (t === 'video') counts.video++
    else counts.photo++
  }
  const total = posts.length
  const dominant = Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0]
  const pctMap = {}
  for (const [k, v] of Object.entries(counts)) pctMap[k] = Math.round((v / total) * 100)

  let recommendation = ''
  if (pctMap.carousel < 15) recommendation = 'Carousels get 2-4x more engagement than photos. Try posting more.'
  else if (pctMap.video < 20) recommendation = 'Reels drive reach for accounts under 50K followers. Add more video.'
  else if (pctMap.photo > 60) recommendation = 'Heavy on photos. Consider converting top performers into carousels.'

  return { dominant, mix: pctMap, recommendation }
}

// ─── Audience depth signal ────────────────────────────────────────────────
function detectAudienceDepth(posts) {
  if (!Array.isArray(posts) || posts.length === 0) return { ratio: 0, label: 'Unknown', description: '' }
  let totalLikes = 0, totalComments = 0
  for (const p of posts) {
    totalLikes += Number(p.likes || p.likesCount || 0)
    totalComments += Number(p.comments || p.commentsCount || 0)
  }
  const ratio = totalLikes > 0 ? (totalComments / totalLikes) * 100 : 0
  // Industry average: 1 comment per 12-15 likes = 6.7-8.3%
  if (ratio >= 8) return { ratio, label: 'Deep', description: 'Your audience actively comments — strong community signal' }
  if (ratio >= 4) return { ratio, label: 'Engaged', description: 'Good comment-to-like ratio — audience is paying attention' }
  if (ratio >= 1) return { ratio, label: 'Passive', description: 'Mostly likers, few commenters — try asking questions in captions' }
  return { ratio, label: 'Silent', description: 'Very few comments — your audience consumes but doesn\'t interact' }
}

// ─── Posting cadence ──────────────────────────────────────────────────────
function detectCadence(posts) {
  if (!Array.isArray(posts) || posts.length < 2) return { avgDaysBetween: null, label: 'Unknown' }
  const timestamps = posts
    .filter(p => p.timestamp)
    .map(p => new Date(p.timestamp).getTime())
    .sort((a, b) => b - a)
  if (timestamps.length < 2) return { avgDaysBetween: null, label: 'Unknown' }
  const gaps = []
  for (let i = 0; i < timestamps.length - 1; i++) {
    gaps.push((timestamps[i] - timestamps[i + 1]) / 86400000)
  }
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const label = avg <= 1 ? 'Daily' : avg <= 3 ? 'Every 2-3 days' : avg <= 7 ? 'Weekly' : avg <= 14 ? 'Bi-weekly' : 'Infrequent'
  return { avgDaysBetween: Math.round(avg * 10) / 10, label }
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Extract brand signals from profile + posts data. Zero AI tokens.
 * Returns a brand profile that renders instantly.
 *
 * @param {object} profile — { username, biography, followersCount, ... }
 * @param {array} posts — recent posts with { caption, type, likes, comments, timestamp }
 * @returns {object} brand profile
 */
export function extractBrand(profile, posts) {
  const captions = (posts || []).map(p => p.caption || '').filter(Boolean)
  const allHashtags = []
  for (const p of (posts || [])) {
    if (Array.isArray(p.hashtags)) allHashtags.push(...p.hashtags)
  }
  // Also extract hashtags from captions
  for (const c of captions) {
    const m = c.match(/#[\w]+/g)
    if (m) allHashtags.push(...m.map(h => h.slice(1).toLowerCase()))
  }

  return {
    voice: detectVoice(captions),
    pillars: detectPillars([...new Set(allHashtags)], captions),
    visualStyle: detectVisualStyle(posts),
    audienceDepth: detectAudienceDepth(posts),
    cadence: detectCadence(posts),
    username: profile?.username || null,
    followers: profile?.followersCount || profile?.followers || null,
    bio: profile?.biography || profile?.bio || null,
  }
}

export default { extractBrand }
