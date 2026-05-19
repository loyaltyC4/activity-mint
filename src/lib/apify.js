// All follower/profile calls are proxied through /api/apify-proxy (server-side)
// so the Apify token never appears in browser JS bundles.

/**
 * Internal helper: POST to the server-side Apify proxy.
 * @param {'followers'|'following'|'profile'} action
 * @param {object} payload - { username, limit? }
 * @returns {Promise<Array>} items array
 */
async function callProxy(action, payload) {
  const res = await fetch('/api/apify-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  let body;
  try { body = await res.json(); } catch { throw new Error(`Proxy error: HTTP ${res.status}`); }
  if (!res.ok || !body.ok) throw new Error(body.error || `Proxy request failed (${res.status})`);
  return body.items;
}

/**
 * Fetch Instagram profile data + recent posts for a public username.
 * Returns an array (usually 1 item) with profilePicUrl, latestPosts, etc.
 */
export async function fetchInstagramProfile(username) {
  return callProxy('profile', { username: username.replace('@', '') });
}

/**
 * Fetch Instagram Stories for a public username.
 * NOTE: Instagram's public API no longer exposes stories — this returns
 * recent posts instead, proxied through the profile scraper.
 */
export async function fetchInstagramStories(username) {
  return callProxy('profile', { username: username.replace('@', '') });
}

/**
 * Fetch followers or following list for a public Instagram account.
 * Routed server-side through /api/apify-proxy to keep the token hidden.
 *
 * @param {string} username - Instagram username
 * @param {'followers'|'following'} listType - Which list to fetch
 * @param {number} limit - Max number of users to fetch (default 200)
 * @returns {Promise<Array>} Array of user objects with username, full_name, profile_pic_url, etc.
 */
export async function fetchFollowersList(username, listType = 'followers', limit = 200) {
  return callProxy(listType, { username: username.replace('@', ''), limit });
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW SCRAPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch Instagram Stories for a public username.
 * Uses gordian/instagram-story-scraper actor.
 */
export async function fetchInstagramStoriesReal(username) {
  return callProxy('stories', { username: username.replace('@', '') });
}

/**
 * Fetch comments from an Instagram post URL.
 * @param {string} postUrl - Full Instagram post URL (e.g. https://instagram.com/p/xyz)
 * @param {number} limit - Max comments to fetch (default 50)
 */
export async function fetchInstagramComments(postUrl, limit = 50) {
  return callProxy('comments', { postUrl, limit });
}

/**
 * Fetch posts from a Facebook page.
 * @param {string} pageUrl - Full Facebook page URL
 * @param {number} limit - Max posts to fetch (default 50)
 */
export async function fetchFacebookPosts(pageUrl, limit = 50) {
  return callProxy('facebook-posts', { pageUrl, limit });
}

/**
 * Fetch TikTok videos from a profile or hashtag.
 * @param {object} options - { username?, hashtag?, limit? }
 */
export async function fetchTikTokVideos({ username, hashtag, limit = 50 }) {
  return callProxy('tiktok', { username, hashtag, limit });
}

/**
 * Fetch LinkedIn posts from a profile or company page.
 * @param {string} profileUrl - Full LinkedIn profile/company URL
 * @param {number} limit - Max posts to fetch (default 10)
 */
export async function fetchLinkedInPosts(profileUrl, limit = 10) {
  return callProxy('linkedin-posts', { profileUrl, limit });
}

/**
 * Fetch LinkedIn profile data (requires cookies for auth).
 * @param {string} profileUrl - Full LinkedIn profile URL
 * @param {Array} cookies - LinkedIn session cookies array
 */
export async function fetchLinkedInProfile(profileUrl, cookies) {
  return callProxy('linkedin-profile', { profileUrl, cookies });
}

/**
 * Fetch YouTube video transcript.
 * @param {string} videoUrl - Full YouTube video URL
 */
export async function fetchYouTubeTranscript(videoUrl) {
  return callProxy('youtube-transcript', { videoUrl });
}
