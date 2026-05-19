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
