// src/lib/creatomate-adapter.js
// Maps a Claude creative brief + Brand DNA + generated asset URLs -> a Creatomate
// render request ({ template_id, modifications, width, height, render_scale, metadata }).
//
// One mapper per video tool. The core (buildRender) merges the shared Brand Kit,
// aspect dimensions, captions, music and preview scaling so each mapper only
// declares what is UNIQUE to that tool.
//
// Design decisions:
// - Scenes use FIXED SLOTS (Scene-1..Scene-6 prebuilt in the template) and we hide
//   unused ones via "Scene-k.visible": false. Far more robust for a SaaS than
//   elements.add; cap = MAX_SCENES. (elements.add path noted at bottom if you ever
//   exceed the cap.)
// - Previews are cheap: opts.preview -> render_scale 0.5 + snapshot only.
// - Every value has a fallback so a partial brief still renders.

const TEMPLATE_IDS = {
  'stock-videos':    process.env.CM_TPL_STOCK,
  'ugc-videos':      process.env.CM_TPL_UGC,
  'product-videos':  process.env.CM_TPL_PRODUCT,        // + variant suffix below
  'ad-videos':       process.env.CM_TPL_AD,
  'fashion-videos':  process.env.CM_TPL_FASHION,        // + variant
  'storytelling-ads':process.env.CM_TPL_STORY,
  'ctv-ads':         process.env.CM_TPL_CTV,
  'blog-videos':     process.env.CM_TPL_BLOG,
};
// Style/motion variants resolve to their own template ids.
const VARIANT_IDS = {
  'product-videos': { Hyper: process.env.CM_TPL_PRODUCT_HYPER, Cinematic: process.env.CM_TPL_PRODUCT_CINE, Showcase: process.env.CM_TPL_PRODUCT_SHOW },
  'fashion-videos': { Runway: process.env.CM_TPL_FASHION_RUNWAY, Editorial: process.env.CM_TPL_FASHION_EDIT, Social: process.env.CM_TPL_FASHION_SOCIAL },
};

const MAX_SCENES = 6;

const ASPECT = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
  '4:5':  { width: 1080, height: 1350 },
};

// ---- shared helpers -------------------------------------------------------

// Brand Kit: identical named elements present in every template.
function buildBrandKit(dna = {}, assets = {}) {
  const accent = (dna.colors && dna.colors[0]) || '#20E0A0';
  const m = {
    'Logo':              dna.logo || '',
    'Brand-Handle':      dna.handle || dna.name || '',
    'Accent-Shape.fill_color': accent,
    'CTA-Text':          '',                 // set per-tool from brief.cta
    'Music':             assets.music || '', // generated/licensed track
  };
  // Only set fonts if the template exposes overridable families (else baked in template).
  if (dna.fonts?.display) m['Headline.font_family'] = dna.fonts.display;
  if (dna.fonts?.body)    m['Body.font_family'] = dna.fonts.body;
  return m;
}

// Wire auto-captions: point the caption element at the audio/clip source.
function withCaptions(sourceName, dna = {}) {
  const accent = (dna.colors && dna.colors[0]) || '#20E0A0';
  return {
    'Captions.transcript_source': sourceName, // e.g. "VO" or "Avatar-Clip"
    'Captions.transcript_color':  accent,
    'Captions.transcript_effect': 'karaoke',
  };
}

// Fill N fixed slots (Prefix-1..Prefix-N) from a list; hide the remainder.
function fillSlots(prefix, items = [], max = MAX_SCENES, prop = '') {
  const mods = {};
  for (let i = 1; i <= max; i++) {
    const v = items[i - 1];
    const key = prop ? `${prefix}-${i}.${prop}` : `${prefix}-${i}`;
    if (v != null && v !== '') { mods[key] = v; mods[`${prefix}-${i}.visible`] = true; }
    else { mods[`${prefix}-${i}.visible`] = false; }
  }
  return mods;
}

// Build scene slots: each scene = a clip + a text line.
function fillScenes(scenes = [], clips = [], max = MAX_SCENES) {
  const mods = {};
  for (let i = 1; i <= max; i++) {
    const s = scenes[i - 1];
    if (s) {
      mods[`Scene-${i}.visible`] = true;
      mods[`Scene-${i}-Clip`]    = clips[i - 1] || '';
      mods[`Scene-${i}-Text`]    = s.text || '';
    } else {
      mods[`Scene-${i}.visible`] = false;
    }
  }
  return mods;
}

// ---- per-tool mappers (only the UNIQUE fields) ----------------------------
// b = brief, a = assets, dna = brandDNA

const MAPPERS = {
  'stock-videos': (b, a, dna) => ({
    'Main-Clip': a.mainClip || (a.clips && a.clips[0]) || '',
    'Caption':   b.headline || b.hook || '',
  }),

  'ugc-videos': (b, a, dna) => ({
    'Avatar-Clip': a.avatarClip || '',
    ...fillSlots('BRoll', a.productClips || a.clips || [], 3),
    'VO':        a.vo || '',
    'Hook-Text': b.hook || '',
    'CTA-Text':  b.cta || '',
    ...withCaptions(a.vo ? 'VO' : 'Avatar-Clip', dna),
  }),

  'ad-videos': (b, a, dna) => ({
    'Product-Clip': a.productClips?.[0] || a.clips?.[0] || '',
    'Hook-Text':  b.hook || '',
    'Offer-Text': b.offer || '',
    'CTA-Text':   b.cta || '',
    'VO':         a.vo || '',
    ...withCaptions('VO', dna),
  }),

  'product-videos': (b, a, dna) => ({
    ...fillSlots('Product-Clip', a.productClips || a.clips || [], 3, 'source'),
    ...fillSlots('Feature-Text', b.features || [], 3),
    'CTA-Text': b.cta || '',
    // VO optional for product videos
    ...(a.vo ? { 'VO': a.vo, ...withCaptions('VO', dna) } : {}),
  }),

  'fashion-videos': (b, a, dna) => ({
    ...fillSlots('Look', a.looks || a.clips || [], MAX_SCENES, 'source'),
    'Brand-Title':     dna.name || '',
    'Collection-Text': b.headline || '',
  }),

  'storytelling-ads': (b, a, dna) => ({
    ...fillScenes(b.scenes, a.sceneClips || a.clips, MAX_SCENES),
    'VO': a.vo || '',
    'CTA-Text': b.cta || '',
    ...withCaptions('VO', dna),
  }),

  'ctv-ads': (b, a, dna) => ({
    'Hero-Clip': a.heroClip || a.clips?.[0] || '',
    'Headline':  b.headline || b.hook || '',
    'CTA-Text':  b.cta || '',
    'VO':        a.vo || '',
    ...withCaptions('VO', dna),
  }),

  'blog-videos': (b, a, dna) => ({
    ...fillScenes(b.scenes, a.sectionClips || a.clips, MAX_SCENES),
    'Narration': a.vo || '',
    ...withCaptions('Narration', dna),
  }),
};

// ---- template id resolution (handles variants) ----------------------------
function resolveTemplateId(tool, brief = {}) {
  const variant = brief.variant; // e.g. "Cinematic", "Runway"
  if (variant && VARIANT_IDS[tool] && VARIANT_IDS[tool][variant]) return VARIANT_IDS[tool][variant];
  return TEMPLATE_IDS[tool];
}

// ---- main entry -----------------------------------------------------------
/**
 * @param {object} brief   Claude creative brief (tool, aspect, durationSec, hook, headline, offer, cta, features[], scenes[], variant)
 * @param {object} brandDNA {name, handle, logo, colors[], fonts:{display,body}, voiceId}
 * @param {object} assets   resolved media URLs {clips[], avatarClip, productClips[], heroClip, mainClip, looks[], sceneClips[], sectionClips[], vo, music}
 * @param {object} opts     {preview, projectId, userId, webhookUrl}
 * @returns {object} Creatomate render request
 */
function buildRender(brief, brandDNA = {}, assets = {}, opts = {}) {
  const tool = brief.tool;
  const mapper = MAPPERS[tool];
  const template_id = resolveTemplateId(tool, brief);
  if (!mapper) throw new Error(`No mapper for tool: ${tool}`);
  if (!template_id) throw new Error(`No template id configured for tool: ${tool}${brief.variant ? ' / ' + brief.variant : ''}`);

  const dims = ASPECT[brief.aspect] || ASPECT['9:16'];

  const modifications = {
    ...buildBrandKit(brandDNA, assets),
    ...mapper(brief, assets, brandDNA),
    'CTA-Text': brief.cta || '',            // ensure CTA wins over brand-kit blank
  };

  // strip empty media sources so the template's placeholder shows instead of a broken URL
  for (const k of Object.keys(modifications)) {
    if (modifications[k] === '' && !/\.(visible|fill_color|transcript_)/.test(k)) delete modifications[k];
  }

  const req = {
    template_id,
    modifications,
    width: dims.width,
    height: dims.height,
    metadata: JSON.stringify({ userId: opts.userId, projectId: opts.projectId, tool }),
  };
  if (opts.webhookUrl) req.webhook_url = opts.webhookUrl;
  if (brief.durationSec) req.duration = brief.durationSec;       // optional override
  if (opts.preview) req.render_scale = 0.5;                      // cheap draft
  return req;
}

// ---- lightweight validation ----------------------------------------------
function validateBrief(brief) {
  const errors = [];
  if (!brief || typeof brief !== 'object') return ['brief missing'];
  if (!MAPPERS[brief.tool]) errors.push(`unknown tool: ${brief.tool}`);
  if (brief.aspect && !ASPECT[brief.aspect]) errors.push(`unknown aspect: ${brief.aspect}`);
  if (['storytelling-ads','blog-videos'].includes(brief.tool) && !(brief.scenes?.length))
    errors.push('scene-based tool requires brief.scenes[]');
  return errors;
}

export { buildRender, validateBrief, MAPPERS, ASPECT, MAX_SCENES };
export default { buildRender, validateBrief, MAPPERS, ASPECT, MAX_SCENES };

// NOTE — exceeding MAX_SCENES: if a story/blog needs >6 scenes, switch fillScenes to the
// Creatomate elements.add operator instead of fixed slots:
//   modifications["Scenes.elements"] is not supported; use root "elements.add": [ {composition}, ... ]
//   built from a scene factory. Fixed slots are recommended until you actually need >6.
