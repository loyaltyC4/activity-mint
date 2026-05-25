/**
 * Vercel Serverless Function: AI Insights — multi-provider.
 *
 * POST /api/ai-insights
 * Body: { request_type, profile?, posts?, analysis?, ads?, topic? }
 * Returns: structured JSON matching request_type.
 *
 * Provider priority (uses whichever key is available):
 *   1. GEMINI_API_KEY   → Google Gemini 2.0 Flash (FREE tier: 15 RPM, 1M tok/day)
 *   2. ANTHROPIC_API_KEY → Claude 3.5 Haiku
 *   3. OPENAI_API_KEY    → GPT-4o-mini
 *
 * The FREE path: get a Gemini key at https://ai.google.dev (no credit card).
 * Set GEMINI_API_KEY in Vercel env vars. AI buttons light up immediately.
 */

const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are the AI brain powering Activity Mint, a B2B Instagram analytics platform.

You receive structured analytics data and respond with actionable output.

## Output format — ALWAYS respond with valid JSON matching the request_type:

For "insights":
{ "insights": ["insight 1", "insight 2", "insight 3"] }

For "scripts":
{ "scripts": ["full caption 1", "full caption 2", "full caption 3"] }

For "ad_scripts":
{ "ad_scripts": ["script 1", "script 2", "script 3"], "inspiration_ad": "brief analysis" }

For "next_post":
{ "format": "Video|Carousel|Photo", "hook": "opening line", "structure": "description", "caption": "full example caption", "rationale": "why this will perform" }

## Rules
- Never use "link in bio" — statistically proven engagement killer.
- Hooks must use proven formulas: Contrarian, Curiosity Gap, Direct Challenge, Social Proof, Question Hook.
- Scripts must be platform-native — written as if a human typed them.
- Be specific and data-driven. Reference the actual numbers provided.
- Keep captions under 300 chars for photo/reel, up to 600 for carousels.
- No generic marketing speak. If data is sparse, say so in one sentence.
- RESPOND WITH JSON ONLY. No markdown, no explanation, no wrapping.`;

// ─────────────────────────────────────────────────────────────────────────────
// Provider implementations
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callAnthropic(userMessage) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

async function callOpenAI(userMessage) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the user message from structured context
// ─────────────────────────────────────────────────────────────────────────────

function buildUserMessage(body) {
  const { request_type, profile, posts, analysis, ads, topic, digest } = body;
  const parts = [];

  // If a compressed digest is provided, use it instead of building from
  // individual fields. Saves ~70% of input tokens.
  if (digest) {
    parts.push(`Request type: ${request_type}`);
    if (topic) parts.push(`Topic: ${topic}`);
    parts.push(`--- PROFILE DIGEST ---\n${digest}`);
    return parts.join('\n\n');
  }
  parts.push(`Request type: ${request_type}`);
  if (topic) parts.push(`Topic/niche: ${topic}`);
  if (profile) {
    parts.push(`Profile: @${profile.username || '?'}, ${profile.followersCount || profile.followers || '?'} followers, ${profile.postsCount || profile.posts || '?'} posts`);
    if (profile.biography) parts.push(`Bio: ${profile.biography.slice(0, 200)}`);
  }
  if (analysis) {
    if (analysis.buckets) parts.push(`Buckets: ${analysis.buckets.winners_n || 0} winners, ${analysis.buckets.losers_n || 0} losers out of ${analysis.posts_count || '?'} posts`);
    if (analysis.lexicon?.winners?.length) {
      parts.push(`High-traction phrases: ${analysis.lexicon.winners.slice(0, 5).map(w => `"${w.phrase}"`).join(', ')}`);
    }
    if (analysis.lexicon?.losers?.length) {
      parts.push(`Dead phrases: ${analysis.lexicon.losers.slice(0, 5).map(l => `"${l.phrase}"`).join(', ')}`);
    }
    if (analysis.blueprint) {
      parts.push(`Blueprint: opener=${analysis.blueprint.common_opener?.label || '?'}, avg_length=${analysis.blueprint.avg_length || '?'}, bullets=${Math.round((analysis.blueprint.uses_bullets_share || 0) * 100)}%`);
    }
    if (analysis.patterns) {
      parts.push(`Format distribution: ${JSON.stringify(analysis.patterns.format_distribution || {})}`);
    }
    if (analysis.opportunities?.length) {
      parts.push(`Opportunities: ${analysis.opportunities.map(o => o.text).join('; ')}`);
    }
  }
  if (posts && Array.isArray(posts)) {
    const topPosts = posts.slice(0, 3).map(p =>
      `- ${p.type || '?'}: ${p.likes || p.likesCount || 0} likes, "${(p.caption || '').slice(0, 80)}..."`
    ).join('\n');
    parts.push(`Top posts:\n${topPosts}`);
  }
  if (ads && Array.isArray(ads)) {
    const topAds = ads.slice(0, 3).map(a =>
      `- ${a.page_name || '?'}: ${a.days_running || '?'}d running, "${(a.body_text || a.title || '').slice(0, 80)}"`
    ).join('\n');
    parts.push(`Top scaling ads:\n${topAds}`);
  }
  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Check which provider is available
  const provider = GEMINI_API_KEY ? 'gemini' : ANTHROPIC_API_KEY ? 'anthropic' : OPENAI_API_KEY ? 'openai' : null;
  if (!provider) {
    return res.status(503).json({
      ok: false,
      error: 'No AI provider configured. Add GEMINI_API_KEY (free at ai.google.dev), ANTHROPIC_API_KEY, or OPENAI_API_KEY to Vercel env vars.',
      fallback: true,
      setup_url: 'https://ai.google.dev',
    });
  }

  const { request_type } = req.body || {};
  if (!request_type) return res.status(400).json({ error: 'request_type required' });

  const userMessage = buildUserMessage(req.body);

  try {
    let rawText;
    if (provider === 'gemini') rawText = await callGemini(userMessage);
    else if (provider === 'anthropic') rawText = await callAnthropic(userMessage);
    else rawText = await callOpenAI(userMessage);

    // Parse JSON from the response
    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);
    } catch {
      if (request_type === 'insights') parsed = { insights: [rawText] };
      else if (request_type === 'scripts') parsed = { scripts: [rawText] };
      else if (request_type === 'next_post') parsed = { format: 'Carousel', caption: rawText, rationale: '' };
      else parsed = { raw: rawText };
    }

    try {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=7200');
    } catch {}

    return res.status(200).json({
      ok: true,
      request_type,
      ...parsed,
      _provider: provider,
    });
  } catch (err) {
    console.error(`[ai-insights] ${provider} error:`, err.message);
    return res.status(502).json({ ok: false, error: err.message, _provider: provider });
  }
}
