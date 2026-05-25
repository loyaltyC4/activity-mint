/**
 * Template Library — preset content templates + prompt builder for
 * AI visual generation.
 *
 * Each template carries:
 *   - Structure: slide-by-slide layout (zone, purpose, prompt template)
 *   - Style: colour palette, typography direction
 *   - Framework citation: WHY this structure works
 *   - Fill-in fields: user replaces __BLANKS__ with their content
 *
 * The prompt builder converts a template + user inputs into an array of
 * image-generation prompts (one per slide). Each prompt produces a
 * 1080x1350 (4:5) Instagram-ready slide.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PRESET TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'stat_shock',
    name: 'Stat Shock Carousel',
    format: 'carousel',
    slide_count: 8,
    description: 'Open with a shocking statistic, break it down across 6 value slides, close with CTA. High-contrast dark background, bold white numbers.',
    framework: 'Hormozi Hook-Retain-Reward + PostEverywhere 8-10 slide rule',
    citation: 'PostEverywhere Feb 2026: 8-10 slides push ER past 2%. Hormozi $100M Leads: hook with a number that creates cognitive dissonance.',
    style: {
      bg: '#0f172a', text: '#ffffff', accent: '#14b8a6',
      font: 'Bold sans-serif (Inter/DM Sans)', mood: 'authoritative, data-driven',
    },
    fields: ['SHOCKING_STAT', 'TOPIC', 'POINT_1', 'POINT_2', 'POINT_3', 'POINT_4', 'POINT_5', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'Shock with a number', prompt: 'Instagram carousel slide, 1080x1350, dark navy (#0f172a) background. In the center, a very large bold white number "__SHOCKING_STAT__" taking up 40% of the slide. Below in smaller white text: "__TOPIC__". Clean minimal design, no images, just typography. Bold sans-serif font.' },
      { zone: 'hook2', purpose: 'Secondary hook (re-serve slide)', prompt: 'Instagram carousel slide, 1080x1350, dark navy (#0f172a) background. Bold white text reading "Here\'s why this matters" with a teal (#14b8a6) accent underline. Clean, minimal, typography-only.' },
      { zone: 'value', purpose: 'Point 1', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "01" in large teal (#14b8a6) text top-left. Below, bold white text: "__POINT_1__". Clean typography, no images.' },
      { zone: 'value', purpose: 'Point 2', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "02" in large teal text top-left. Below, bold white text: "__POINT_2__". Clean typography.' },
      { zone: 'value', purpose: 'Point 3', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "03" in large teal text top-left. Below, bold white text: "__POINT_3__". Clean typography.' },
      { zone: 'value', purpose: 'Point 4', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "04" in large teal text top-left. Below, bold white text: "__POINT_4__". Clean typography.' },
      { zone: 'value', purpose: 'Point 5', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Number "05" in large teal text top-left. Below, bold white text: "__POINT_5__". Clean typography.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, dark navy background. Bold white text: "__CTA_TEXT__". Below, a teal (#14b8a6) arrow pointing right. Text "Swipe left for more" in small teal text at top. Clean, bold, minimal.' },
    ],
  },
  {
    id: 'chris_do_typography',
    name: 'Chris Do Typography Post',
    format: 'photo',
    slide_count: 1,
    description: 'Single-image post with one bold contrarian statement on a pure black or white background. Typography IS the content. No images, no decoration.',
    framework: 'Chris Do 5-Pillar: Hook + Clarity + X-Factor. The Futur.',
    citation: 'The Futur / Chris Do: "The headline must compel the viewer to dig deeper." Typography is the X-Factor.',
    style: {
      bg: '#000000', text: '#ffffff', accent: '#ffffff',
      font: 'Extra-bold sans-serif, centered', mood: 'provocative, minimal',
    },
    fields: ['STATEMENT'],
    slides: [
      { zone: 'hook', purpose: 'Contrarian statement', prompt: 'Instagram post, 1080x1350, pure black (#000000) background. In the exact center, bold white text in a large clean sans-serif font: "__STATEMENT__". Nothing else on the slide. No images, no borders, no decoration. Just the text, perfectly centered, bold, large.' },
    ],
  },
  {
    id: 'behind_the_scenes_reel',
    name: 'Behind The Scenes Reel',
    format: 'reel',
    slide_count: 0,
    description: 'Script structure for a 15-25 second BTS reel. Hook (selfie), process (action shots), result (reveal).',
    framework: 'Gary Vee "Document Don\'t Create" + Hormozi Hook-Retain-Reward',
    citation: 'Gary Vaynerchuk: "Document, don\'t create." Hormozi: Hook captures, Retain shows value, Reward delivers the payoff.',
    style: { bg: 'n/a', text: 'n/a', accent: 'n/a', font: 'n/a', mood: 'authentic, raw' },
    fields: ['HOOK_LINE', 'PROCESS_DESCRIPTION', 'RESULT_REVEAL'],
    slides: [
      { zone: 'hook', purpose: 'Selfie hook (0-3s)', prompt: null, script: 'TO CAMERA: "__HOOK_LINE__" — delivered directly, no intro, mid-energy. Film on phone, natural light.' },
      { zone: 'retain', purpose: 'Process montage (3-18s)', prompt: null, script: 'CUT TO: __PROCESS_DESCRIPTION__ — 3-4 quick cuts of the work. No voiceover needed, just ambient sound or trending audio.' },
      { zone: 'reward', purpose: 'Result reveal (18-25s)', prompt: null, script: 'FINAL SHOT: __RESULT_REVEAL__ — hold on the result for 3 seconds. Text overlay: "The result speaks."' },
    ],
  },
  {
    id: 'value_ladder',
    name: 'Value Ladder Carousel',
    format: 'carousel',
    slide_count: 10,
    description: '10-slide carousel that teaches 5 levels of a concept, from beginner to advanced. Numbered slides, clean progression.',
    framework: 'Hormozi Value Ladder + Chris Do 5-Pillar (Fulfillment)',
    citation: 'Hormozi: "The goal is to provide value upfront." PostEverywhere Feb 2026: 8-10 slides push ER past 2%.',
    style: {
      bg: '#ffffff', text: '#0f172a', accent: '#8b5cf6',
      font: 'Clean sans-serif, left-aligned', mood: 'educational, structured',
    },
    fields: ['TOPIC', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'Title slide', prompt: 'Instagram carousel slide, 1080x1350, white background. Bold dark text: "5 Levels of __TOPIC__" with a subtle purple (#8b5cf6) gradient underline. "From beginner to pro" in smaller grey text below. Clean, minimal, educational feel.' },
      { zone: 'hook2', purpose: 'Why this matters', prompt: 'Instagram carousel slide, 1080x1350, white background. Text: "Most people stay at Level 1. Here\'s how to reach Level 5." Dark text, purple accent on "Level 5". Swipe CTA at bottom.' },
      { zone: 'value', purpose: 'Level 1', prompt: 'Instagram carousel slide, 1080x1350, white background. Large purple "Level 1" badge top-left. Bold dark heading: "__LEVEL_1__". Clean layout, educational tone.' },
      { zone: 'value', purpose: 'Level 2', prompt: 'Same style. "Level 2" badge. Heading: "__LEVEL_2__".' },
      { zone: 'value', purpose: 'Level 3', prompt: 'Same style. "Level 3" badge. Heading: "__LEVEL_3__".' },
      { zone: 'value', purpose: 'Level 4', prompt: 'Same style. "Level 4" badge. Heading: "__LEVEL_4__".' },
      { zone: 'value', purpose: 'Level 5', prompt: 'Same style. "Level 5" badge with gold accent. Heading: "__LEVEL_5__". This is the advanced insight.' },
      { zone: 'value', purpose: 'Summary', prompt: 'Instagram carousel slide, 1080x1350, white background. Recap all 5 levels as a numbered list, dark text. Purple left border bar. Clean, scannable.' },
      { zone: 'value', purpose: 'Personal note', prompt: 'Instagram carousel slide, 1080x1350, white background. Handwritten-style text: "I was stuck at Level 2 for years. Here\'s what changed:" in dark italic text. Authentic, vulnerable tone.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, white background. Bold text: "__CTA_TEXT__". Purple arrow. "Save this for later" in small text. Swipe-left CTA.' },
    ],
  },
  {
    id: 'before_after',
    name: 'Before / After Carousel',
    format: 'carousel',
    slide_count: 8,
    description: 'Transformation story: slide 1 = the "before" state, slide 2-6 = the journey/process, slide 7-8 = the "after" + CTA.',
    framework: 'Hormozi PAS (Problem-Agitation-Solution) + carousel hook rules',
    citation: 'GetKoro.app Feb 2026: Hook-Value-CTA structure. AdLibrary.com May 2026: PAS framework for ad creation.',
    style: {
      bg: '#fafaf9', text: '#1c1917', accent: '#ea580c',
      font: 'Clean sans-serif', mood: 'transformational, honest',
    },
    fields: ['BEFORE_STATE', 'PAIN_POINT', 'STEP_1', 'STEP_2', 'STEP_3', 'AFTER_STATE', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'The Before state', prompt: 'Instagram carousel slide, 1080x1350, warm off-white background. Large bold dark text: "__BEFORE_STATE__". Red-orange (#ea580c) "BEFORE" tag in corner. Slightly gritty, imperfect feel.' },
      { zone: 'hook2', purpose: 'The pain point', prompt: 'Instagram carousel slide, 1080x1350, warm off-white background. Text: "__PAIN_POINT__". Empathetic tone, dark text, red-orange accent underline.' },
      { zone: 'value', purpose: 'Step 1', prompt: 'Instagram carousel slide, 1080x1350, clean white background. "Step 1" in bold orange. Text: "__STEP_1__". Clean, actionable layout.' },
      { zone: 'value', purpose: 'Step 2', prompt: 'Same style. "Step 2". Text: "__STEP_2__".' },
      { zone: 'value', purpose: 'Step 3', prompt: 'Same style. "Step 3". Text: "__STEP_3__".' },
      { zone: 'value', purpose: 'The result', prompt: 'Instagram carousel slide, 1080x1350, warm off-white background. Large text: "The result?" in bold dark type. Building anticipation.' },
      { zone: 'reward', purpose: 'The After state', prompt: 'Instagram carousel slide, 1080x1350, clean bright background. Large bold text: "__AFTER_STATE__". Green (#16a34a) "AFTER" tag in corner. Bright, optimistic, transformed feel.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, warm background. Bold text: "__CTA_TEXT__". Orange accent. "Save + share with someone who needs this" at bottom.' },
    ],
  },
  {
    id: 'question_hook',
    name: 'Hormozi Question Carousel',
    format: 'carousel',
    slide_count: 8,
    description: 'Opens with a provocative question, answers it across value slides, closes with the truth bomb. Dark background, high contrast.',
    framework: 'Hormozi Question Hook + Hook-Retain-Reward',
    citation: 'WritingHooks.com (Hormozi hooks): "Why does __X__? Because __Y__." Go-Viral.app Feb 2026: Question hooks are one of 7 proven formulas.',
    style: {
      bg: '#18181b', text: '#fafafa', accent: '#facc15',
      font: 'Extra-bold sans-serif', mood: 'provocative, confrontational',
    },
    fields: ['QUESTION', 'MYTH_1', 'MYTH_2', 'REAL_ANSWER', 'EVIDENCE_1', 'EVIDENCE_2', 'TRUTH_BOMB', 'CTA_TEXT'],
    slides: [
      { zone: 'hook', purpose: 'The question', prompt: 'Instagram carousel slide, 1080x1350, near-black (#18181b) background. Large bold white text with yellow (#facc15) question mark: "__QUESTION__?" Provocative, confrontational typography. Nothing else.' },
      { zone: 'hook2', purpose: 'The myths', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Text: "Most people think:" then "__MYTH_1__" and "__MYTH_2__" each crossed out with a yellow strikethrough. Bold, white text.' },
      { zone: 'value', purpose: 'The real answer', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Yellow "THE TRUTH" badge top. Bold white text: "__REAL_ANSWER__". Clean, authoritative.' },
      { zone: 'value', purpose: 'Evidence 1', prompt: 'Instagram carousel slide, 1080x1350, near-black background. White text: "__EVIDENCE_1__". Data-driven, cited feel.' },
      { zone: 'value', purpose: 'Evidence 2', prompt: 'Instagram carousel slide, 1080x1350, near-black background. White text: "__EVIDENCE_2__". Supporting evidence.' },
      { zone: 'value', purpose: 'Summary', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Recap with numbered points in white text, yellow numbers.' },
      { zone: 'reward', purpose: 'Truth bomb close', prompt: 'Instagram carousel slide, 1080x1350, near-black background. Large yellow text: "__TRUTH_BOMB__". This is the Hormozi truth bomb. Bold, centered, impactful.' },
      { zone: 'cta', purpose: 'Call to action', prompt: 'Instagram carousel slide, 1080x1350, near-black background. White text: "__CTA_TEXT__". Yellow arrow. "Follow for more" in small text.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fill a template's slide prompts with user-provided values.
 * Returns an array of { slide_number, zone, purpose, prompt, script? }
 * ready for image generation.
 *
 * @param {string} templateId
 * @param {object} values — keys matching the template's fields (e.g. { SHOCKING_STAT: '93%', TOPIC: '...' })
 * @returns {{ template, filledSlides }}
 */
function buildPrompts(templateId, values = {}) {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new Error(`Template not found: ${templateId}`);

  const filledSlides = template.slides.map((slide, i) => {
    let prompt = slide.prompt;
    let script = slide.script || null;
    // Replace all __FIELD__ placeholders
    if (prompt) {
      for (const [key, val] of Object.entries(values)) {
        prompt = prompt.replace(new RegExp(`__${key}__`, 'g'), val || `[${key}]`);
      }
    }
    if (script) {
      for (const [key, val] of Object.entries(values)) {
        script = script.replace(new RegExp(`__${key}__`, 'g'), val || `[${key}]`);
      }
    }
    return {
      slide_number: i + 1,
      zone: slide.zone,
      purpose: slide.purpose,
      prompt,
      script,
      needs_image: !!prompt, // Reels have script-only slides
    };
  });

  return { template, filledSlides };
}

/**
 * Auto-fill a template from Script Studio analysis + user topic.
 * Uses the analysis to suggest values for template fields.
 */
function autoFill(templateId, analysis, topic) {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return {};

  const winners = analysis?.lexicon?.winners || [];
  const losers = analysis?.lexicon?.losers || [];
  const blueprint = analysis?.blueprint || {};
  const topSample = analysis?.samples?.winners?.[0];

  const values = {};

  if (templateId === 'stat_shock') {
    values.SHOCKING_STAT = analysis?.buckets
      ? `${Math.round((analysis.buckets.losers_n / (analysis.posts_count || 1)) * 100)}%`
      : '73%';
    values.TOPIC = topic || 'of posts underperform their potential';
    values.POINT_1 = winners[0] ? `Posts with "${winners[0].phrase}" get ${Math.round(Math.exp(winners[0].delta) * 100 - 100)}% more engagement` : 'Your top content follows a specific pattern';
    values.POINT_2 = losers[0] ? `"${losers[0].phrase}" kills engagement by ${Math.abs(Math.round(Math.exp(losers[0].delta) * 100 - 100))}%` : 'Certain phrases actively hurt your reach';
    values.POINT_3 = blueprint.common_opener ? `${Math.round((blueprint.common_opener.share || 0) * 100)}% of your winners use ${blueprint.common_opener.label} openers` : 'Your winning posts share a structural pattern';
    values.POINT_4 = `Average winning caption: ${blueprint.avg_length || 200} characters` ;
    values.POINT_5 = topic ? `The data says: lean into ${topic} content` : 'Double down on what the numbers prove works';
    values.CTA_TEXT = 'Follow for data-driven content strategy';
  }

  if (templateId === 'chris_do_typography') {
    values.STATEMENT = topic || (winners[0] ? `The word "${winners[0].phrase}" is worth more than your entire marketing budget.` : 'Your content strategy is a math problem disguised as a creative one.');
  }

  if (templateId === 'question_hook') {
    values.QUESTION = topic ? `Why does ${topic} actually work` : 'Why do 93% of carousels underperform';
    values.MYTH_1 = 'It\'s about posting more often';
    values.MYTH_2 = 'You need better photos';
    values.REAL_ANSWER = losers[0] ? `Stop saying "${losers[0].phrase}" — it statistically kills engagement` : 'The structure matters more than the visuals';
    values.EVIDENCE_1 = winners[0] ? `Posts with "${winners[0].phrase}" outperform by ${Math.round(Math.exp(winners[0].delta) * 100 - 100)}%` : 'Data from 50 posts proves the pattern';
    values.EVIDENCE_2 = 'Mixed-media carousels hit 2.33% ER vs 1.80% for image-only (CreatorsJet 2025)';
    values.TRUTH_BOMB = 'Your content already has the answers. You just need to read the data.';
    values.CTA_TEXT = 'Save this. Share it. Then check your own numbers.';
  }

  return values;
}

export { TEMPLATES, buildPrompts, autoFill };
export default { TEMPLATES, buildPrompts, autoFill };
