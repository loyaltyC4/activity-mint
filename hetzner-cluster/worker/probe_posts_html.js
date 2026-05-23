/**
 * Posts inline-JSON diagnostic.
 *
 * Navigates to a target profile and prints WHICH inline-JSON anchors are
 * present in the HTML so we can update the posts.js regex to match what IG
 * actually ships in 2026. Also dumps a sample of the candidate JSON
 * substrings so we can eyeball the shape.
 */
'use strict';
const fs = require('fs');

const IG_USERNAME = process.env.IG_USERNAME || '';
const IG_PASSWORD = process.env.IG_PASSWORD || '';
const TARGET = process.env.TARGET || 'nasa';
const PROXY_HOST = process.env.PROXY_HOST || '';
const PROXY_USER = process.env.PROXY_USER || '';
const PROXY_PASS = process.env.PROXY_PASS || '';
const PROXY_PORT = process.env.PROXY_HTTP_PORT || '50100';

(async () => {
  const cb = await import('cloakbrowser');
  const proxy = PROXY_HOST ? `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}` : undefined;

  const ctx = await cb.launchPersistentContext({
    userDataDir: '/app/profile',
    headless: true,
    proxy,
    geoip: true,
    viewport: { width: 1366, height: 800 },
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  ctx.setDefaultTimeout(20000);
  const page = (await ctx.pages())[0] || await ctx.newPage();

  // We assume the persistent profile is already logged in from prior worker
  // runs (the profile dir we mount has cookies). Skip login entirely.
  console.log(`[probe] navigating to https://www.instagram.com/${TARGET}/`);
  await page.goto(`https://www.instagram.com/${TARGET}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);

  const url = page.url();
  const title = await page.title().catch(() => '');
  console.log(`[probe] url=${url} title=${title}`);

  const html = await page.content();
  console.log(`[probe] html length=${html.length}`);

  // NEW: ALSO call web_profile_info API from page context and dump shape
  const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(TARGET)}`;
  console.log(`\n[probe] calling API ${apiUrl}`);
  const apiData = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u, {
        headers: {
          'x-ig-app-id': '936619743392459',
          'accept': 'application/json',
          'sec-fetch-site': 'same-origin',
        },
        credentials: 'include',
      });
      const ct = r.headers.get('content-type') || '';
      const status = r.status;
      let body;
      try { body = await r.json(); } catch (e) { body = { __parse_err: e.message }; }
      return { status, ct, body };
    } catch (e) {
      return { __err: e.message };
    }
  }, apiUrl).catch((e) => ({ __err: e.message }));
  console.log(`[probe] API status=${apiData?.status} ct=${apiData?.ct}`);
  if (apiData?.body) {
    const b = apiData.body;
    console.log(`[probe] body top keys: ${Object.keys(b).join(', ')}`);
    if (b.data) console.log(`[probe] body.data keys: ${Object.keys(b.data).join(', ')}`);
    if (b.data?.user) {
      const u = b.data.user;
      console.log(`[probe] body.data.user keys: ${Object.keys(u).join(', ')}`);
      // Look for any *_media or posts-like keys
      const mediaLike = Object.keys(u).filter(k => /media|post|reel|timeline/i.test(k));
      console.log(`[probe] media-like keys: ${mediaLike.join(', ')}`);
      for (const k of mediaLike) {
        const v = u[k];
        if (v && typeof v === 'object') {
          console.log(`  ${k}: keys=[${Object.keys(v).join(',')}] count=${v.count} edgesLen=${(v.edges||[]).length}`);
          if (v.edges && v.edges[0]) {
            console.log(`    first edge node keys: ${Object.keys(v.edges[0].node || {}).join(',').slice(0, 400)}`);
          }
        }
      }
    } else if (b.user) {
      console.log(`[probe] body.user keys: ${Object.keys(b.user).join(', ')}`);
    } else {
      console.log(`[probe] body sample: ${JSON.stringify(b).slice(0, 800)}`);
    }
    // Save full response to file for deeper inspection
    fs.writeFileSync('/app/profile/probe_api_response.json', JSON.stringify(b, null, 2).slice(0, 50000));
  }

  // Anchor scan: count occurrences of every known/likely posts-edges anchor.
  const anchors = [
    'edge_owner_to_timeline_media',
    'edge_felix_video_timeline',
    'edge_media_collections',
    'xdt_api__v1__feed__user_timeline_graphql_connection',
    'xdt_api_v1_feed_user_timeline',
    'PolarisProfilePageContentDirectQuery',
    'PolarisProfilePageContentQuery',
    'XDTUserFeedFragment',
    '"shortcode":"',
    '"taken_at":',
    '"taken_at_timestamp":',
    '"display_url":"',
    '"image_versions2"',
    '"is_video":',
    '"like_count":',
    '"comment_count":',
  ];
  for (const a of anchors) {
    const re = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = html.match(re) || [];
    console.log(`  [${matches.length.toString().padStart(4)}] ${a}`);
  }

  // Take the FIRST shortcode and dump ~1.5KB around it so we can see what
  // fields are nearby and how the JSON is shaped.
  const sm = html.match(/"shortcode"\s*:\s*"([^"]+)"/);
  if (sm) {
    const idx = html.indexOf(sm[0]);
    const ctxStart = Math.max(0, idx - 200);
    const ctxEnd = Math.min(html.length, idx + 1400);
    console.log('\n[probe] context around first shortcode match:');
    console.log(html.substring(ctxStart, ctxEnd));
    fs.writeFileSync('/app/profile/probe_posts_html_excerpt.txt', html.substring(ctxStart, ctxEnd));
  } else {
    console.log('[probe] NO "shortcode" match anywhere in HTML');
  }

  // Also save the full HTML to a file so the workflow can inspect
  fs.writeFileSync('/app/profile/probe_posts_html_full.html', html);
  console.log('\n[probe] dumped full HTML to /app/profile/probe_posts_html_full.html');
  console.log('OUTCOME: probe_done');

  await ctx.close();
  process.exit(0);
})().catch((err) => {
  console.error(`[probe] FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
