/**
 * Script Studio backend logic — performance calculation + NLP extraction.
 *
 * Architecture (mathematical):
 *   LAYER 1 — Performance Calculation
 *     E_i = engagement score per post = likes + w_c * comments + w_v * sqrt(views)
 *     baseline = median(E) over last N posts of the same media-type
 *     delta_P = (E_i - baseline) / baseline
 *     bucket = winners (>+0.5) | losers (<-0.3) | neutral
 *
 *   LAYER 2 — Semantic Extraction (no LLM)
 *     hook = first 12 tokens of caption
 *     n-grams = 1-3 grams across all caption tokens
 *     log-odds-ratio with informative Dirichlet prior (Monroe et al. 2008)
 *       to identify phrases significantly distinguishing winners from losers
 *     blueprint = pattern detection on opener/body/ending across winners
 *
 *   LAYER 3 — Script generation (deterministic templates, LLM-optional)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — Performance calculation
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHTS = {
  w_c: 5,      // comments worth 5x a like (require more audience effort)
  w_v: 0.01,   // video views scaled by sqrt then weighted (prevent reel domination)
};

/**
 * Engagement score for one post. Uses sqrt(videoViews) so reels with millions
 * of views don't dwarf comment/like signal from regular posts.
 */
function computeEngagementScore(post, weights = DEFAULT_WEIGHTS) {
  const likes = Number(post.likesCount ?? post.likes ?? 0);
  const comments = Number(post.commentsCount ?? post.comments ?? 0);
  const views = Number(post.videoViewCount ?? post.videoPlayCount ?? post.video_view_count ?? 0);
  return likes + (weights.w_c * comments) + (weights.w_v * Math.sqrt(Math.max(0, views)));
}

function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute baseline medians grouped by media-type. Photos, videos, and
 * carousels typically have wildly different engagement patterns, so each
 * gets its own baseline. Falls back to global median if a type has <3 samples.
 */
function computeBaselines(posts, weights = DEFAULT_WEIGHTS) {
  const byType = { Image: [], Video: [], Sidecar: [] };
  const all = [];
  for (const p of posts) {
    const score = computeEngagementScore(p, weights);
    all.push(score);
    const t = p.type || 'Image';
    if (byType[t]) byType[t].push(score);
    else byType[t] = [score];
  }
  const global = median(all);
  const baselines = { global };
  for (const t of Object.keys(byType)) {
    baselines[t] = byType[t].length >= 3 ? median(byType[t]) : global;
  }
  return baselines;
}

/**
 * Per-post performance delta: (E_i - baseline) / baseline. Uses the
 * media-type-specific baseline if the bucket has enough samples.
 */
function computePerformanceDelta(post, baselines, weights = DEFAULT_WEIGHTS) {
  const score = computeEngagementScore(post, weights);
  const base = baselines[post.type || 'Image'] || baselines.global;
  if (!base || base === 0) return 0;
  return (score - base) / base;
}

/**
 * Sort posts into winners / losers / neutral buckets by delta_P.
 * Posts younger than minAgeHours are excluded (haven't accumulated enough
 * engagement to score fairly).
 */
function bucketPosts(posts, opts = {}) {
  const winnerThreshold = opts.winnerThreshold ?? 0.5;
  const loserThreshold = opts.loserThreshold ?? -0.3;
  const minAgeHours = opts.minAgeHours ?? 24;
  const weights = opts.weights || DEFAULT_WEIGHTS;
  const baselines = computeBaselines(posts, weights);

  const now = Date.now();
  const eligible = posts.filter((p) => {
    if (!p.timestamp) return true;
    const ageMs = now - new Date(p.timestamp).getTime();
    return ageMs >= minAgeHours * 3600 * 1000;
  });

  const scored = eligible.map((p) => ({
    post: p,
    score: computeEngagementScore(p, weights),
    delta: computePerformanceDelta(p, baselines, weights),
  }));

  const winners = scored.filter((s) => s.delta >= winnerThreshold);
  const losers = scored.filter((s) => s.delta <= loserThreshold);
  const neutral = scored.filter((s) => s.delta > loserThreshold && s.delta < winnerThreshold);

  return { winners, losers, neutral, baselines, scored };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — Semantic extraction (NLP)
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','to','of','in','on',
  'at','by','from','with','as','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may',
  'might','must','can','i','you','he','she','it','we','they','this','that',
  'these','those','my','your','his','her','its','our','their','me','him','us',
  'them','what','which','who','whom','when','where','why','how','all','any',
  'both','each','few','more','most','other','some','such','no','nor','not',
  'only','own','same','so','than','too','very','just','about','also','out',
  'up','down','over','under','here','there','now','then','back','still','via',
]);

/**
 * Tokenize a caption. Lowercase, strip URLs/mentions/hashtags/punct/emojis,
 * keep contractions intact. Returns flat array of word tokens.
 */
function tokenize(caption) {
  if (!caption || typeof caption !== 'string') return [];
  let s = caption.toLowerCase();
  s = s.replace(/https?:\/\/\S+/g, ' ');         // urls
  s = s.replace(/[@#][\w._-]+/g, ' ');           // mentions/hashtags
  s = s.replace(/[^\p{L}\p{N}'\-\s]/gu, ' ');    // strip non-letter/digit/apostrophe
  return s.split(/\s+/).filter((w) => w.length >= 2);
}

/** First N tokens of the caption = the hook. */
function extractHook(caption, n = 12) {
  return tokenize(caption).slice(0, n);
}

/** Build n-gram counts (1..maxN) from a list of token arrays. Stopwords
 * dropped for n=1, kept inside n≥2 (a stopword inside a phrase is signal). */
function ngramCounts(documents, maxN = 3) {
  const counts = new Map();
  for (const tokens of documents) {
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        if (n === 1 && STOPWORDS.has(tokens[i])) continue;
        const phrase = tokens.slice(i, i + n).join(' ');
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Log-odds ratio with informative Dirichlet prior (Monroe, Colaresi, Quinn 2008).
 * Returns Map<phrase, { delta, z, count_w, count_l }>. Positive delta = winner-distinctive,
 * negative = loser-distinctive. |z| > 1.96 ~ 95% significance.
 */
function logOddsWithPrior(winnersBag, losersBag, alpha = 0.01) {
  const W = sumCounts(winnersBag);
  const L = sumCounts(losersBag);
  const total = W + L;
  const allPhrases = new Set([...winnersBag.keys(), ...losersBag.keys()]);
  const a0 = alpha * allPhrases.size;
  const result = new Map();
  for (const phrase of allPhrases) {
    const cw = winnersBag.get(phrase) || 0;
    const cl = losersBag.get(phrase) || 0;
    const a = alpha;
    const numW = (cw + a) / (W + a0 - cw - a);
    const numL = (cl + a) / (L + a0 - cl - a);
    const delta = Math.log(numW) - Math.log(numL);
    const sigma2 = 1 / (cw + a) + 1 / (cl + a);
    const z = delta / Math.sqrt(sigma2);
    result.set(phrase, { delta, z, count_w: cw, count_l: cl });
  }
  return result;
}

function sumCounts(map) {
  let s = 0;
  for (const v of map.values()) s += v;
  return s;
}

/**
 * Pick the top-K positive-delta phrases (winners) and top-K negative-delta
 * phrases (losers). Filter to phrases with at least minCount total occurrences
 * to avoid noise from singletons.
 */
function topPhrasesByDelta(logOddsMap, opts = {}) {
  const k = opts.k || 15;
  const minCount = opts.minCount || 2;
  const minAbsZ = opts.minAbsZ || 1.0;
  const entries = Array.from(logOddsMap.entries())
    .filter(([, v]) => (v.count_w + v.count_l) >= minCount)
    .filter(([, v]) => Math.abs(v.z) >= minAbsZ);
  const winners = entries
    .filter(([, v]) => v.delta > 0)
    .sort(([, a], [, b]) => b.delta - a.delta)
    .slice(0, k)
    .map(([phrase, v]) => ({ phrase, ...v }));
  const losers = entries
    .filter(([, v]) => v.delta < 0)
    .sort(([, a], [, b]) => a.delta - b.delta)
    .slice(0, k)
    .map(([phrase, v]) => ({ phrase, ...v }));
  return { winners, losers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structural blueprint detection
// ─────────────────────────────────────────────────────────────────────────────

const OPENER_PATTERNS = [
  { id: 'negative-imperative', re: /^(stop|don't|never|avoid|quit)\b/i, label: 'Negative imperative ("Stop doing X")' },
  { id: 'question',            re: /^(what|why|how|when|who|which|where|do|does|is|are|can|could|should|will|would|have|has)\b.*\?/i, label: 'Question hook' },
  { id: 'statistic',           re: /^\d+%|^\d+\s+out\s+of|^\d+x\b|^\d+,\d+|^\$\d/i, label: 'Statistic opener' },
  { id: 'imperative',          re: /^(let|here's|here is|listen|read|watch|imagine)\b/i, label: 'Imperative / call to attention' },
  { id: 'declaration',         re: /^(i|we|my|our)\b/i, label: 'First-person declaration' },
  { id: 'contrarian',          re: /^(but|however|actually|truthfully|honestly)\b/i, label: 'Contrarian opener' },
];

function classifyOpener(caption) {
  if (!caption) return null;
  const firstLine = caption.split(/\n|\.\s/)[0].trim();
  for (const p of OPENER_PATTERNS) {
    if (p.re.test(firstLine)) return { id: p.id, label: p.label };
  }
  return { id: 'plain', label: 'Plain statement' };
}

function analyzeBody(caption) {
  if (!caption) return { has_bullets: false, has_list: false, paragraph_count: 0, body_length: 0 };
  return {
    has_bullets: /^\s*[•\-\*]\s/m.test(caption),
    has_list: /^\s*\d+[.)]\s/m.test(caption),
    paragraph_count: caption.split(/\n\s*\n/).length,
    body_length: caption.length,
  };
}

function classifyEnding(caption) {
  if (!caption) return null;
  const trimmed = caption.trim();
  if (/\?\s*(#|$)/.test(trimmed)) return { id: 'question-ask', label: 'Ends with a question' };
  if (/(comment|share|tag|tell me|let me know|drop|reply)\b/i.test(trimmed.slice(-200))) return { id: 'cta', label: 'Explicit CTA' };
  if (trimmed.split('#').length > 5) return { id: 'hashtag-spam', label: 'Hashtag-heavy close' };
  if (/[.!]\s*[A-Z][^#@\n]{20,}$/.test(trimmed)) return { id: 'anecdote', label: 'Anecdote close' };
  return { id: 'none', label: 'Plain close' };
}

/** Aggregate the most common opener / body / ending pattern across winners. */
function summarizeBlueprint(winnerPosts) {
  if (!winnerPosts || winnerPosts.length === 0) {
    return { ok: false, reason: 'no-winner-sample' };
  }
  const openerCounts = new Map();
  const endingCounts = new Map();
  let bulletCount = 0, listCount = 0;
  let totalLen = 0;
  for (const w of winnerPosts) {
    const cap = w.post?.caption || w.caption || '';
    if (!cap) continue;
    const op = classifyOpener(cap);
    const en = classifyEnding(cap);
    const body = analyzeBody(cap);
    openerCounts.set(op.id, (openerCounts.get(op.id) || 0) + 1);
    endingCounts.set(en.id, (endingCounts.get(en.id) || 0) + 1);
    if (body.has_bullets) bulletCount += 1;
    if (body.has_list) listCount += 1;
    totalLen += body.body_length;
  }
  const total = winnerPosts.length;
  const topOpener = Array.from(openerCounts.entries()).sort(([, a], [, b]) => b - a)[0];
  const topEnding = Array.from(endingCounts.entries()).sort(([, a], [, b]) => b - a)[0];
  return {
    ok: true,
    sample_size: total,
    common_opener: topOpener ? { id: topOpener[0], label: OPENER_PATTERNS.find((p) => p.id === topOpener[0])?.label || 'Plain', share: topOpener[1] / total } : null,
    common_ending: topEnding ? { id: topEnding[0], share: topEnding[1] / total } : null,
    uses_bullets_share: bulletCount / total,
    uses_list_share: listCount / total,
    avg_length: Math.round(totalLen / total),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — Deterministic script template generator (LLM-optional)
// ─────────────────────────────────────────────────────────────────────────────

/** Generate 3 fill-in-the-blank scripts using the structural blueprint
 * and top winning phrases. Deterministic, no LLM call. */
function generateScripts(blueprint, lexicon, opts = {}) {
  if (!blueprint || !blueprint.ok) return [];
  const topPhrases = lexicon?.winners?.slice(0, 5).map((w) => w.phrase) || [];
  const phraseFiller = topPhrases.length > 0 ? topPhrases[0] : '__YOUR_KEY_TERM__';

  const openerTemplates = {
    'negative-imperative': [`Stop chasing __VAGUE_GOAL__.`, `Don't make this mistake with __TOPIC__.`, `Never confuse __TERM_A__ with __TERM_B__.`],
    'question':            [`What if __SURPRISING_CLAIM__?`, `Why is everyone ignoring ${phraseFiller}?`, `How did __SOMEONE__ go from __BEFORE__ to __AFTER__?`],
    'statistic':           [`__N__% of people get __TOPIC__ wrong.`, `__N__x more __OUTCOME__ when you __TACTIC__.`, `$__AMOUNT__ in __WINDOW__ — here's how.`],
    'imperative':          [`Read this before you __ACTION__.`, `Here's the one thing about ${phraseFiller} nobody talks about.`, `Imagine __FUTURE_STATE__.`],
    'declaration':         [`I tried __APPROACH__ for __DURATION__ — here's what worked.`, `My biggest lesson on ${phraseFiller}.`, `We thought __ASSUMPTION__. We were wrong.`],
    'contrarian':          [`But everyone misses this: __INSIGHT__.`, `Actually, ${phraseFiller} is the opposite of what they tell you.`, `Honestly, __HARD_TRUTH__.`],
    'plain':               [`Here's what changed when I __ACTION__.`, `Today I learned about ${phraseFiller}.`, `Quick story about __SUBJECT__.`],
  };
  const opener = blueprint.common_opener?.id || 'plain';
  const openers = openerTemplates[opener] || openerTemplates.plain;

  const bodyMold = blueprint.uses_bullets_share > 0.4
    ? '\n\nThree things to remember:\n- __POINT_1__\n- __POINT_2__\n- __POINT_3__'
    : blueprint.uses_list_share > 0.4
      ? '\n\n1. __STEP_ONE__\n2. __STEP_TWO__\n3. __STEP_THREE__'
      : `\n\n__MAIN_INSIGHT__. The detail nobody mentions is __NUANCE__.`;

  const endingMold = {
    'question-ask':  '\n\nWhat would YOU do? __',
    'cta':           '\n\nDrop a 🚀 if this resonates. Save this for later.',
    'hashtag-spam':  '\n\n#__TAG_1__ #__TAG_2__ #__TAG_3__',
    'anecdote':      '\n\nA year ago I __PAST_STATE__. Today __CURRENT_STATE__. The difference: __ONE_THING__.',
    'none':          '',
  };
  const ending = endingMold[blueprint.common_ending?.id || 'none'] || '';

  return openers.slice(0, 3).map((o) => `${o}${bodyMold}${ending}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full Script Studio pipeline against an array of post records.
 * Each post needs: { likesCount, commentsCount, type, caption, timestamp,
 * shortCode, displayUrl, videoViewCount? }.
 * Returns { ok, buckets, lexicon, blueprint, scripts, baselines, samples }.
 */
function analyze(posts, opts = {}) {
  if (!Array.isArray(posts) || posts.length < 3) {
    return { ok: false, reason: 'insufficient-posts', posts_count: posts?.length || 0, error: `Need at least 3 posts (found ${posts?.length || 0})` };
  }

  // Layer 1: bucket
  const { winners, losers, neutral, baselines, scored } = bucketPosts(posts, opts);

  // Layer 2: NLP on captions of winners + losers (drop neutral)
  const winnerHooks = winners.map((s) => extractHook(s.post.caption || ''));
  const loserHooks = losers.map((s) => extractHook(s.post.caption || ''));
  const winnerTokens = winners.map((s) => tokenize(s.post.caption || ''));
  const loserTokens = losers.map((s) => tokenize(s.post.caption || ''));
  const winnersBag = ngramCounts(winnerTokens, 3);
  const losersBag = ngramCounts(loserTokens, 3);
  const lo = logOddsWithPrior(winnersBag, losersBag);
  const lexicon = topPhrasesByDelta(lo, { k: 15, minCount: 2, minAbsZ: 0.8 });

  // Structural blueprint from winners
  const blueprint = summarizeBlueprint(winners);

  // Layer 3: template scripts
  const scripts = generateScripts(blueprint, lexicon);

  // Top-3 winners + losers for the UI
  const topWinnerSamples = winners
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((s) => ({
      shortcode: s.post.shortCode || s.post.shortcode,
      caption: (s.post.caption || '').slice(0, 240),
      likes: s.post.likesCount,
      comments: s.post.commentsCount,
      type: s.post.type,
      delta: s.delta,
      displayUrl: s.post.displayUrl,
    }));
  const topLoserSamples = losers
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3)
    .map((s) => ({
      shortcode: s.post.shortCode || s.post.shortcode,
      caption: (s.post.caption || '').slice(0, 240),
      likes: s.post.likesCount,
      comments: s.post.commentsCount,
      type: s.post.type,
      delta: s.delta,
      displayUrl: s.post.displayUrl,
    }));

  return {
    ok: true,
    posts_count: posts.length,
    buckets: {
      winners_n: winners.length,
      losers_n: losers.length,
      neutral_n: neutral.length,
    },
    baselines,
    lexicon,
    blueprint,
    scripts,
    samples: { winners: topWinnerSamples, losers: topLoserSamples },
    // Histogram-ready data for the UI: deltas + their dates
    distribution: scored.map((s) => ({
      delta: s.delta,
      score: s.score,
      shortcode: s.post.shortCode,
      taken_at: s.post.timestamp,
      type: s.post.type,
    })),
  };
}

export {
  // Layer 1
  computeEngagementScore,
  median,
  computeBaselines,
  computePerformanceDelta,
  bucketPosts,
  // Layer 2
  tokenize,
  extractHook,
  ngramCounts,
  logOddsWithPrior,
  topPhrasesByDelta,
  classifyOpener,
  analyzeBody,
  classifyEnding,
  summarizeBlueprint,
  // Layer 3
  generateScripts,
  // Pipeline
  analyze,
};

// Default export bundle (for `import scriptStudio from ...` callers)
export default {
  computeEngagementScore, median, computeBaselines, computePerformanceDelta,
  bucketPosts, tokenize, extractHook, ngramCounts, logOddsWithPrior,
  topPhrasesByDelta, classifyOpener, analyzeBody, classifyEnding,
  summarizeBlueprint, generateScripts, analyze,
};
