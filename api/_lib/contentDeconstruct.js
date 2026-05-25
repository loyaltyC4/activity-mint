/**
 * Content Deconstruction Engine — breaks any Instagram post into a
 * reproducible template schema.
 *
 * Architecture:
 *   Input:  a post object (from Apify) + optional Script Studio analysis
 *   Output: a template schema with every structural element labelled,
 *           scored against research-backed frameworks, and tagged with
 *           practitioner citations.
 *
 * Research basis (57 findings, 55 sources — see doc cmpleuoc705m806adq0vge7ns):
 *   - 8 carousel rules (slide count, hook/value/CTA zones, mixed-media, swipe CTA)
 *   - 7 Reel hook formulas (Contrarian, Curiosity Gap, Visual Interrupt, etc.)
 *   - Chris Do 5-Pillar rubric (Hook, Clarity, Fulfillment, Typography, X-Factor)
 *   - Hormozi Hook-Retain-Reward + 6-Part Ad Framework
 *   - Engagement benchmarks by tier + format + industry (Buffer 27M posts)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS: research-backed benchmarks + framework taxonomies
// ─────────────────────────────────────────────────────────────────────────────

/** ER benchmarks by follower tier. Source: Buffer 27M posts + CreatiCalc 2026. */
const ER_TIERS = [
  { max: 1_000,     label: 'Nano (<1K)',     avg: 5.2, good: 8,   excellent: 12 },
  { max: 10_000,    label: 'Nano (1K-10K)',  avg: 4.0, good: 6,   excellent: 10 },
  { max: 50_000,    label: 'Micro',          avg: 2.6, good: 4,   excellent: 6 },
  { max: 100_000,   label: 'Mid-Tier',       avg: 1.4, good: 3,   excellent: 5 },
  { max: 500_000,   label: 'Mid-Large',      avg: 0.7, good: 1.5, excellent: 3 },
  { max: 1_000_000, label: 'Macro',          avg: 0.5, good: 1.0, excellent: 2 },
  { max: Infinity,  label: 'Mega (1M+)',     avg: 0.4, good: 0.8, excellent: 1.5 },
];

function getTierBenchmark(followers) {
  return ER_TIERS.find((t) => followers < t.max) || ER_TIERS[ER_TIERS.length - 1];
}

/** Format-specific ER benchmarks. Source: CreatorsJet Aug 2025 + PostEverywhere Feb 2026. */
const FORMAT_ER = {
  carousel: { avg: 1.65, good: 4, excellent: 7 },
  video:    { avg: 1.15, good: 3, excellent: 6 },
  photo:    { avg: 0.58, good: 1.5, excellent: 3 },
};

/**
 * 7 Reel hook formulas. Source: Go-Viral.app Feb 2026.
 * Each has a regex pattern for caption-based detection and a fill-in-the-blank template.
 */
const HOOK_FORMULAS = [
  {
    id: 'contrarian',
    label: 'Contrarian',
    description: '"Everything you know about X is wrong"',
    re: /^(everything|everyone|most people|nobody|no one|they don't|you've been|you're wrong|stop believing)/i,
    template: 'Everything you know about __TOPIC__ is wrong. Here\'s what actually works:',
    source: 'Go-Viral.app Feb 2026; Hormozi $100M Leads',
  },
  {
    id: 'curiosity_gap',
    label: 'Curiosity Gap',
    description: '"I discovered something about X that changed everything"',
    re: /^(i (just )?discovered|i found|i learned|the secret|what (nobody|no one)|here's what|the truth about|the one thing)/i,
    template: 'I discovered something about __TOPIC__ that changed everything:',
    source: 'Go-Viral.app Feb 2026',
  },
  {
    id: 'visual_interrupt',
    label: 'Visual Interrupt',
    description: 'Unexpected visual in the first frame that stops the scroll',
    re: /^(wait|watch|look at|see this|check this|you won't believe)/i,
    template: '[UNEXPECTED VISUAL] + __SURPRISING_CLAIM__',
    source: 'Go-Viral.app Feb 2026',
  },
  {
    id: 'wait_what',
    label: '"Wait What?"',
    description: 'Pattern break that confuses then resolves',
    re: /^(so i|okay so|this is going to sound|hear me out|i know this sounds)/i,
    template: 'So I __DID_SOMETHING_ODD__. And it actually __RESULT__.',
    source: 'Go-Viral.app Feb 2026',
  },
  {
    id: 'direct_challenge',
    label: 'Direct Challenge',
    description: '"You\'re doing X wrong"',
    re: /^(you're doing|stop doing|don't|never|quit|avoid|if you're still)/i,
    template: 'You\'re doing __THING__ wrong. Here\'s why:',
    source: 'Go-Viral.app Feb 2026; Hormozi "Direct Truth Bomb"',
  },
  {
    id: 'social_proof',
    label: 'Social Proof',
    description: '"After working with 500+ clients..."',
    re: /^(after (working|helping|coaching|training)|in my \d+ years|having (worked|helped|trained)|i've (worked|helped|built|grown))/i,
    template: 'After __CREDENTIAL__, here\'s the #1 thing I\'d change:',
    source: 'Go-Viral.app Feb 2026',
  },
  {
    id: 'mid_action',
    label: 'Mid-Action Start',
    description: 'Begin mid-story, no setup — drop the viewer into the action',
    re: null, // Can't detect from caption alone; needs video analysis
    template: '[START IN THE MIDDLE OF THE ACTION] — no intro, no setup.',
    source: 'Go-Viral.app Feb 2026',
  },
];

/** Hormozi hook types from $100M Leads. Source: WritingHooks.com */
const HORMOZI_HOOKS = [
  {
    id: 'truth_bomb',
    label: 'Truth Bomb',
    re: /^(most people will never|if your .+ isn't|the .+ sells you|here's the .+ truth)/i,
    template: 'Most people will never __OUTCOME__. Not because __EXCUSE_1__. Because __REAL_CAUSE__.',
    source: 'Hormozi, $100M Leads; WritingHooks.com',
  },
  {
    id: 'result_hook',
    label: 'Result Hook',
    re: /^\$?\d+[KkMm]?\s+(in|per|a)\s/i,
    template: '$__AMOUNT__ in __TIMEFRAME__ — here\'s the exact playbook:',
    source: 'Hormozi, $100M Leads',
  },
  {
    id: 'question_hook',
    label: 'Question Hook',
    re: /^(what if|why (do|does|is|are|don't|can't)|how (do|does|did|can|could)|when was|where do)/i,
    template: 'Why does __COUNTERINTUITIVE_THING__? Because __INSIGHT__.',
    source: 'Hormozi, $100M Leads',
  },
];

/**
 * Chris Do 5-Pillar Carousel Evaluation. Source: The Futur.
 * Each pillar is scored 0-20 (total 0-100).
 */
const CHRIS_DO_PILLARS = [
  { id: 'hook', label: 'The Hook', description: 'Does the headline compel the viewer to dig deeper?' },
  { id: 'clarity', label: 'Clarity', description: 'Can the audience immediately understand the message?' },
  { id: 'fulfillment', label: 'Fulfillment', description: 'Does the content provide genuine value?' },
  { id: 'typography', label: 'Typography', description: 'Legibility and hierarchy of text elements' },
  { id: 'x_factor', label: 'X-Factor', description: 'What makes it uniquely yours? Signature style.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAPTION ANALYSIS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','for','to','of','in','on','at','by',
  'from','with','as','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','can','i','you','he',
  'she','it','we','they','this','that','my','your','his','her','its','our',
  'their','me','him','us','them','so','just','also','very','too','not','no',
]);

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[@#][\w._-]+/g, ' ')
    .replace(/[^\p{L}\p{N}'\-\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function extractHashtags(text) {
  if (!text) return [];
  const m = text.match(/#[\p{L}\p{N}_]+/gu);
  return m ? [...new Set(m.map((s) => s.slice(1).toLowerCase()))] : [];
}

function extractMentions(text) {
  if (!text) return [];
  const m = text.match(/@[\w.]+/g);
  return m ? [...new Set(m.map((s) => s.slice(1).toLowerCase()))] : [];
}

function classifyHookFormula(caption) {
  if (!caption) return null;
  const firstLine = caption.split(/\n|\.\s/)[0].trim();
  // Check Hormozi hooks first (more specific)
  for (const h of HORMOZI_HOOKS) {
    if (h.re && h.re.test(firstLine)) {
      return { ...h, matched_text: firstLine.slice(0, 80), framework: 'hormozi' };
    }
  }
  // Then general hook formulas
  for (const h of HOOK_FORMULAS) {
    if (h.re && h.re.test(firstLine)) {
      return { ...h, matched_text: firstLine.slice(0, 80), framework: 'hook_formula' };
    }
  }
  return { id: 'plain', label: 'Plain Statement', matched_text: firstLine.slice(0, 80), framework: null };
}

function analyseCaptionStructure(caption) {
  if (!caption) return { opener: null, body: null, ending: null, length: 0 };
  const lines = caption.split('\n').filter((l) => l.trim());
  const paragraphs = caption.split(/\n\s*\n/).filter((p) => p.trim());
  const hasBullets = /^\s*[•\-\*]\s/m.test(caption);
  const hasList = /^\s*\d+[.)]\s/m.test(caption);
  const endsWithQuestion = /\?\s*(#|$)/.test(caption.trim());
  const endsWithCTA = /(comment|share|tag|tell me|let me know|drop|reply|save this|follow)\b/i.test(caption.slice(-200));
  const hasSwipeCTA = /(swipe|slide|next|more|keep reading)/i.test(caption);

  return {
    opener: lines[0]?.slice(0, 80) || null,
    body_type: hasBullets ? 'bullets' : hasList ? 'numbered-list' : 'prose',
    has_bullets: hasBullets,
    has_list: hasList,
    has_swipe_cta: hasSwipeCTA,
    ending_type: endsWithQuestion ? 'question' : endsWithCTA ? 'cta' : 'plain',
    paragraph_count: paragraphs.length,
    line_count: lines.length,
    length: caption.length,
    word_count: tokenize(caption).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT-SPECIFIC DECONSTRUCTORS
// ─────────────────────────────────────────────────────────────────────────────

function deconstructCarousel(post) {
  const children = post.childPosts || post.carouselItems || post.carousel_media || [];
  const slideCount = children.length || (post.images?.length || 1);
  const mixedMedia = children.some((c) =>
    (c.mediaType === 'video' || c.type === 'Video') &&
    children.some((c2) => c2.mediaType === 'image' || c2.type === 'Image')
  );

  // Analyse each slide
  const slides = children.map((child, i) => {
    const isVideo = child.mediaType === 'video' || child.type === 'Video';
    return {
      slide_number: i + 1,
      media_type: isVideo ? 'video' : 'image',
      image_url: child.imageUrl || child.displayUrl || null,
      video_url: child.videoUrl || null,
      // Zone classification per research Rule 5: Hook(1) - Value(2-8) - CTA(9-10)
      zone: i === 0 ? 'hook' : (i >= slideCount - 2 ? 'cta' : 'value'),
      is_slide_2: i === 1, // Research Rule 3: slide 2 is the re-serve hook
    };
  });

  // Carousel quality signals (research-backed rules)
  const rules = {
    optimal_slide_count: slideCount >= 7 && slideCount <= 10,
    has_mixed_media: mixedMedia,
    slide_count: slideCount,
    slide_2_is_strong: slides.length >= 2, // Can't fully evaluate without OCR, flag for attention
  };

  return {
    format: 'carousel',
    slide_count: slideCount,
    slides,
    is_mixed_media: mixedMedia,
    rules,
    framework_notes: [
      slideCount >= 8 && slideCount <= 10
        ? { text: 'Optimal 8-10 slide range', source: 'PostEverywhere Feb 2026', signal: 'positive' }
        : { text: `${slideCount} slides (optimal is 8-10)`, source: 'PostEverywhere Feb 2026', signal: slideCount < 7 ? 'negative' : 'neutral' },
      mixedMedia
        ? { text: 'Mixed-media carousel (2.33% avg ER — top 7% use this)', source: 'CreatorsJet Aug 2025', signal: 'positive' }
        : { text: 'Image-only carousel (1.80% ER — consider adding a video slide for 2.33%)', source: 'CreatorsJet Aug 2025', signal: 'opportunity' },
    ],
  };
}

function deconstructReel(post) {
  const duration = post.videoDuration || post.duration || post.video_duration || null;
  const durationSeconds = duration ? Math.round(duration) : null;

  // Duration quality per research: 15-30s = sweet spot (Retensis Apr 2026)
  let durationSignal = 'unknown';
  if (durationSeconds) {
    if (durationSeconds >= 15 && durationSeconds <= 30) durationSignal = 'optimal';
    else if (durationSeconds < 15) durationSignal = 'too_short';
    else if (durationSeconds <= 60) durationSignal = 'acceptable';
    else durationSignal = 'long';
  }

  return {
    format: 'reel',
    duration_seconds: durationSeconds,
    duration_signal: durationSignal,
    has_caption: !!(post.caption),
    caption_length: (post.caption || '').length,
    framework_notes: [
      durationSeconds && durationSeconds >= 15 && durationSeconds <= 30
        ? { text: `${durationSeconds}s — in the 15-30s sweet spot`, source: 'Retensis Apr 2026', signal: 'positive' }
        : durationSeconds
          ? { text: `${durationSeconds}s — sweet spot is 15-30s`, source: 'Retensis Apr 2026', signal: durationSeconds < 15 ? 'negative' : 'neutral' }
          : null,
      { text: '65% of viewers drop off before second 4 — hook is everything', source: 'Go-Viral.app Feb 2026', signal: 'info' },
    ].filter(Boolean),
  };
}

function deconstructPhoto(post) {
  return {
    format: 'photo',
    has_caption: !!(post.caption),
    caption_length: (post.caption || '').length,
    framework_notes: [
      { text: 'Photos avg 0.45-0.72% ER — lowest of all formats', source: 'PostEverywhere Feb 2026', signal: 'info' },
      { text: 'Consider converting to a carousel for 2-4x engagement lift', source: 'CreatorsJet Aug 2025', signal: 'opportunity' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DECONSTRUCTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deconstruct a single post into its template schema.
 *
 * @param {object} post — Apify post object with { shortCode, type, caption,
 *   likesCount, commentsCount, timestamp, childPosts?, images?, videoViewCount? }
 * @param {object} opts — { followers?, analysis? (Script Studio output) }
 * @returns {object} template schema
 */
function deconstructPost(post, opts = {}) {
  if (!post) return null;
  const followers = opts.followers || 0;
  const caption = post.caption || '';
  const likes = Number(post.likesCount ?? post.likes ?? 0);
  const comments = Number(post.commentsCount ?? post.comments ?? 0);
  const views = Number(post.videoViewCount ?? post.videoPlayCount ?? 0);
  const er = followers > 0 ? ((likes + comments) / followers) * 100 : 0;

  // Determine format
  const rawType = post.type || 'Image';
  const format = rawType === 'Sidecar' || rawType === 'carousel' ? 'carousel'
    : rawType === 'Video' || rawType === 'video' ? 'reel'
    : 'photo';

  // Format-specific deconstruction
  const formatData = format === 'carousel' ? deconstructCarousel(post)
    : format === 'reel' ? deconstructReel(post)
    : deconstructPhoto(post);

  // Hook analysis
  const hookFormula = classifyHookFormula(caption);

  // Caption structure
  const captionStructure = analyseCaptionStructure(caption);

  // Hashtag analysis (Rule 8: 3-5 optimal)
  const hashtags = extractHashtags(caption);
  const mentions = extractMentions(caption);
  const hashtagSignal = hashtags.length >= 3 && hashtags.length <= 5 ? 'optimal'
    : hashtags.length > 5 ? 'too_many' : 'too_few';

  // Performance grading vs tier + format benchmarks
  const tier = getTierBenchmark(followers);
  const formatBench = FORMAT_ER[format] || FORMAT_ER.photo;
  const performanceGrade = er >= formatBench.excellent ? 'exceptional'
    : er >= formatBench.good ? 'strong'
    : er >= formatBench.avg ? 'average'
    : 'below_average';

  // Chris Do 5-Pillar partial evaluation (automated where possible)
  const chrisDoScore = {
    hook: hookFormula.id !== 'plain' ? 16 : 10, // Strong hook pattern = 16/20, plain = 10/20
    clarity: captionStructure.word_count <= 300 ? 15 : 10, // Concise = clearer
    fulfillment: captionStructure.has_bullets || captionStructure.has_list ? 16 : 12, // Structured value = higher
    typography: null, // Requires visual analysis — not automatable from caption
    x_factor: null, // Requires brand knowledge — not automatable
    total_automated: null, // Sum of non-null pillars
  };
  const automatedPillars = [chrisDoScore.hook, chrisDoScore.clarity, chrisDoScore.fulfillment].filter((v) => v != null);
  chrisDoScore.total_automated = automatedPillars.reduce((a, b) => a + b, 0);
  chrisDoScore.max_possible_automated = automatedPillars.length * 20;

  // Hormozi Hook-Retain-Reward mapping
  const hrr = {
    hook: captionStructure.opener,
    retain: captionStructure.body_type,
    reward: captionStructure.ending_type === 'cta' ? 'call-to-action'
      : captionStructure.ending_type === 'question' ? 'engagement-question'
      : 'implicit',
  };

  // Build the complete template schema
  return {
    // Source identification
    source_shortcode: post.shortCode || post.shortcode || null,
    source_username: post.ownerUsername || opts.username || null,
    source_url: post.url || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null),
    timestamp: post.timestamp || null,

    // Performance metrics
    performance: {
      likes,
      comments,
      video_views: views || null,
      engagement_rate: er,
      performance_grade: performanceGrade,
      tier_benchmark: tier,
      format_benchmark: formatBench,
    },

    // Format-specific breakdown
    ...formatData,

    // Caption analysis
    caption: {
      full_text: caption.slice(0, 2000),
      structure: captionStructure,
      hook: hookFormula,
      hashtags,
      hashtag_count: hashtags.length,
      hashtag_signal: hashtagSignal,
      mentions,
      mention_count: mentions.length,
    },

    // Framework evaluations
    frameworks: {
      chris_do_5_pillar: chrisDoScore,
      hormozi_hrr: hrr,
      hook_formula: hookFormula,
    },

    // Framework citations (every note carries its source)
    citations: [
      ...(formatData.framework_notes || []),
      hookFormula.source ? { text: `Hook type: ${hookFormula.label}`, source: hookFormula.source, signal: hookFormula.id !== 'plain' ? 'positive' : 'neutral' } : null,
      { text: `Hashtags: ${hashtags.length} (optimal 3-5)`, source: 'PostEverywhere Feb 2026', signal: hashtagSignal === 'optimal' ? 'positive' : 'opportunity' },
      captionStructure.has_swipe_cta
        ? { text: 'Has swipe CTA (lifts ER from 1.83% to 2%)', source: 'Embryo Apr 2025', signal: 'positive' }
        : format === 'carousel'
          ? { text: 'Missing swipe CTA (only 5% include one, but it lifts ER 9%)', source: 'Embryo Apr 2025', signal: 'opportunity' }
          : null,
      captionStructure.ending_type === 'cta'
        ? { text: 'Explicit CTA in caption', source: 'Hormozi Hook-Retain-Reward', signal: 'positive' }
        : { text: 'No explicit CTA — consider adding an engagement prompt', source: 'Hormozi Hook-Retain-Reward', signal: 'opportunity' },
    ].filter(Boolean),

    // Reproducible template skeleton
    template_skeleton: {
      format,
      hook_type: hookFormula.id,
      hook_template: hookFormula.template || null,
      body_structure: captionStructure.body_type,
      ending_type: captionStructure.ending_type,
      caption_length_target: captionStructure.length,
      slide_count: formatData.slide_count || null,
      is_mixed_media: formatData.is_mixed_media || false,
      hashtag_count_target: Math.min(Math.max(hashtags.length, 3), 5),
    },
  };
}

/**
 * Batch-deconstruct all posts for a profile. Returns the full set
 * plus a summary with aggregate patterns.
 */
function deconstructProfile(posts, opts = {}) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return { ok: false, reason: 'no-posts', posts_count: 0 };
  }

  const templates = posts.map((p) => deconstructPost(p, opts)).filter(Boolean);

  // Aggregate patterns
  const formatDist = {};
  const hookDist = {};
  const bodyDist = {};
  const endingDist = {};
  let totalER = 0;
  let mixedMediaCount = 0;
  let swipeCTACount = 0;

  for (const t of templates) {
    formatDist[t.format] = (formatDist[t.format] || 0) + 1;
    hookDist[t.caption.hook.id] = (hookDist[t.caption.hook.id] || 0) + 1;
    bodyDist[t.caption.structure.body_type] = (bodyDist[t.caption.structure.body_type] || 0) + 1;
    endingDist[t.caption.structure.ending_type] = (endingDist[t.caption.structure.ending_type] || 0) + 1;
    totalER += t.performance.engagement_rate;
    if (t.is_mixed_media) mixedMediaCount += 1;
    if (t.caption.structure.has_swipe_cta) swipeCTACount += 1;
  }

  const n = templates.length;
  const sortedByER = [...templates].sort((a, b) => b.performance.engagement_rate - a.performance.engagement_rate);

  return {
    ok: true,
    posts_count: n,
    templates,
    top_performers: sortedByER.slice(0, 5),
    bottom_performers: sortedByER.slice(-3),
    patterns: {
      format_distribution: formatDist,
      hook_distribution: hookDist,
      body_structure_distribution: bodyDist,
      ending_distribution: endingDist,
      avg_engagement_rate: n > 0 ? totalER / n : 0,
      mixed_media_usage: n > 0 ? mixedMediaCount / n : 0,
      swipe_cta_usage: n > 0 ? swipeCTACount / n : 0,
    },
    opportunities: [
      mixedMediaCount === 0 && formatDist.carousel
        ? { text: 'You never use mixed-media carousels — they hit 2.33% ER vs 1.80% for image-only', source: 'CreatorsJet Aug 2025', impact: 'high' }
        : null,
      swipeCTACount === 0 && formatDist.carousel
        ? { text: 'None of your carousels include a "swipe left" prompt — adding one lifts ER 9%', source: 'Embryo Apr 2025', impact: 'medium' }
        : null,
      !hookDist.contrarian && !hookDist.direct_challenge && !hookDist.curiosity_gap
        ? { text: 'Your hooks are all plain statements — try Contrarian or Direct Challenge hooks for 2-3x reach', source: 'Go-Viral.app Feb 2026', impact: 'high' }
        : null,
      !formatDist.carousel && (opts.followers || 0) >= 50_000
        ? { text: 'You have >50K followers but no carousels — carousels outperform Reels for engagement at your size', source: 'CreatorsJet Aug 2025', impact: 'high' }
        : null,
    ].filter(Boolean),
  };
}

export {
  // Constants
  ER_TIERS, FORMAT_ER, HOOK_FORMULAS, HORMOZI_HOOKS, CHRIS_DO_PILLARS,
  // Helpers
  getTierBenchmark, classifyHookFormula, analyseCaptionStructure,
  tokenize, extractHashtags, extractMentions,
  // Deconstructors
  deconstructPost, deconstructCarousel, deconstructReel, deconstructPhoto,
  // Profile-level
  deconstructProfile,
};

export default {
  ER_TIERS, FORMAT_ER, HOOK_FORMULAS, HORMOZI_HOOKS, CHRIS_DO_PILLARS,
  getTierBenchmark, classifyHookFormula, analyseCaptionStructure,
  deconstructPost, deconstructProfile,
};
