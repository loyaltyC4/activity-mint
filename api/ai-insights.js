/**
 * Vercel Serverless Function: AI Insights via Claude Haiku.
 *
 * POST /api/ai-insights
 * Body: { request_type, profile?, posts?, analysis?, ads?, topic? }
 * Returns: structured JSON matching request_type (insights, scripts,
 *          ad_scripts, next_post).
 *
 * Uses the Activity Mint AI agent's system prompt (baked in here) with
 * Claude Haiku for fast, cheap inference. The same prompt is used by
 * the Hyperagent named agent — keeping them in sync.
 *
 * Env: ANTHROPIC_API_KEY (required)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
- No generic marketing speak. If data is sparse, say so in one sentence.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'ANTHROPIC_API_KEY not configured. Add it to Vercel env vars.',
      fallback: true,
    });
  }

  const { request_type, profile, posts, analysis, ads, topic } = req.body || {};
  if (!request_type) return res.status(400).json({ error: 'request_type required' });

  // Build the user message from the provided context
  const contextParts = [];
  contextParts.push(`Request type: ${request_type}`);
  if (topic) contextParts.push(`Topic/niche: ${topic}`);
  if (profile) {
    contextParts.push(`Profile: @${profile.username || '?'}, ${profile.followersCount || profile.followers || '?'} followers, ${profile.postsCount || profile.posts || '?'} posts, ER: ${profile.engagementRate || '?'}%`);
    if (profile.biography) contextParts.push(`Bio: ${profile.biography.slice(0, 200)}`);
  }
  if (analysis) {
    if (analysis.buckets) contextParts.push(`Buckets: ${analysis.buckets.winners_n || 0} winners, ${analysis.buckets.losers_n || 0} losers out of ${analysis.posts_count || '?'} posts`);
    if (analysis.lexicon?.winners?.length) {
      contextParts.push(`High-traction phrases: ${analysis.lexicon.winners.slice(0, 5).map(w => `"${w.phrase}"`).join(', ')}`);
    }
    if (analysis.lexicon?.losers?.length) {
      contextParts.push(`Dead phrases: ${analysis.lexicon.losers.slice(0, 5).map(l => `"${l.phrase}"`).join(', ')}`);
    }
    if (analysis.blueprint) {
      contextParts.push(`Blueprint: opener=${analysis.blueprint.common_opener?.label || '?'}, avg_length=${analysis.blueprint.avg_length || '?'}, bullets=${Math.round((analysis.blueprint.uses_bullets_share || 0) * 100)}%`);
    }
  }
  if (posts && Array.isArray(posts)) {
    const topPosts = posts.slice(0, 3).map(p =>
      `- ${p.type || '?'}: ${p.likes || p.likesCount || 0} likes, "${(p.caption || '').slice(0, 80)}..."`
    ).join('\n');
    contextParts.push(`Top posts:\n${topPosts}`);
  }
  if (ads && Array.isArray(ads)) {
    const topAds = ads.slice(0, 3).map(a =>
      `- ${a.page_name || '?'}: ${a.days_running || '?'}d running, "${(a.body_text || a.title || '').slice(0, 80)}"`
    ).join('\n');
    contextParts.push(`Top scaling ads:\n${topAds}`);
  }

  const userMessage = contextParts.join('\n\n');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.warn(`[ai-insights] Anthropic ${resp.status}: ${errBody.slice(0, 300)}`);
      return res.status(502).json({ ok: false, error: `AI service error (${resp.status})` });
    }

    const body = await resp.json();
    const text = body?.content?.[0]?.text || '';

    // Parse the JSON from the response
    let parsed;
    try {
      // Try to extract JSON from the response (Claude sometimes wraps in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch (parseErr) {
      // If JSON parsing fails, return the raw text wrapped in the expected shape
      if (request_type === 'insights') parsed = { insights: [text] };
      else if (request_type === 'scripts') parsed = { scripts: [text] };
      else if (request_type === 'next_post') parsed = { format: 'Carousel', caption: text, rationale: '' };
      else parsed = { raw: text };
    }

    // Cache for 1 hour (same analysis = same output)
    try {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=7200');
    } catch {}

    return res.status(200).json({
      ok: true,
      request_type,
      ...parsed,
      _model: 'claude-3-5-haiku',
    });
  } catch (err) {
    console.error('[ai-insights] error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'AI request failed' });
  }
}
