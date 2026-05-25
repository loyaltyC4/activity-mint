// Vercel Serverless Function: generate carousel slide images via OpenAI
// POST /api/generate-slides
// Body: { prompts: string[], aspectRatio?: "4:5"|"1:1", quality?: "low"|"medium"|"high" }
// Returns: { ok: true, slides: [{ index, url, prompt }] }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'OPENAI_API_KEY not configured. Add it to Vercel env vars to enable image generation.',
      fallback: true
    });
  }

  const { prompts, aspectRatio = '4:5', quality = 'medium' } = req.body || {};
  if (!Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json({ error: 'prompts array required' });
  }
  if (prompts.length > 12) {
    return res.status(400).json({ error: 'Max 12 slides per generation' });
  }

  // Map aspect ratio to OpenAI's supported sizes
  const sizeMap = {
    '4:5': '1024x1536',
    '1:1': '1024x1024',
    '16:9': '1536x1024',
    '9:16': '1024x1536',
  };
  const size = sizeMap[aspectRatio] || '1024x1536';

  try {
    // Generate all slides in parallel
    const results = await Promise.all(
      prompts.map(async (prompt, index) => {
        try {
          const resp = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-image-1',
              prompt: prompt,
              n: 1,
              size: size,
              quality: quality,
            }),
          });

          if (!resp.ok) {
            const errBody = await resp.text();
            console.warn(`[generate-slides] OpenAI error for slide ${index}: ${resp.status} ${errBody.slice(0, 200)}`);
            return { index, error: `OpenAI ${resp.status}`, url: null, prompt };
          }

          const data = await resp.json();
          // OpenAI returns data[0].url (temporary URL, valid ~1h) or data[0].b64_json
          const imageUrl = data.data?.[0]?.url || null;
          return { index, url: imageUrl, prompt, error: null };
        } catch (err) {
          console.warn(`[generate-slides] slide ${index} failed: ${err.message}`);
          return { index, error: err.message, url: null, prompt };
        }
      })
    );

    const successCount = results.filter(r => r.url).length;

    return res.status(200).json({
      ok: true,
      slides: results,
      generated: successCount,
      total: prompts.length,
      model: 'gpt-image-1',
      size,
      quality,
    });
  } catch (err) {
    console.error('[generate-slides] error:', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}
