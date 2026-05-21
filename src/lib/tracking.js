import { supabase } from './supabase';

/**
 * Save a snapshot to Supabase (throttled to once per hour per account).
 * Gracefully falls back to localStorage if the table doesn't exist yet.
 */
export async function saveSnapshotDB(userId, username, data) {
  if (!userId || !username) return;

  // Throttle: don't save more than once per hour per account
  try {
    const { data: recent, error: checkErr } = await supabase
      .from('account_snapshots')
      .select('created_at')
      .eq('user_id', userId)
      .eq('username', username)
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkErr) throw checkErr;

    if (recent?.length && Date.now() - new Date(recent[0].created_at).getTime() < 3600000) return;

    await supabase.from('account_snapshots').insert({
      user_id: userId,
      username,
      followers_count: data.followers || 0,
      following_count: data.following || 0,
      posts_count: data.posts || 0,
      engagement_rate: data.er || 0,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Table may not exist yet — fall back to localStorage
    console.warn('saveSnapshotDB: falling back to localStorage', err.message);
    saveSnapshotLocal(username, data);
  }
}

/**
 * Get snapshots from Supabase (with localStorage fallback).
 */
export async function getSnapshotsDB(userId, username) {
  if (!userId || !username) return [];

  try {
    const { data, error } = await supabase
      .from('account_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('username', username)
      .order('created_at', { ascending: true })
      .limit(60);

    if (error) throw error;
    if (data?.length) return data;
  } catch (err) {
    console.warn('getSnapshotsDB: falling back to localStorage', err.message);
  }

  // Fallback to localStorage
  const local = JSON.parse(localStorage.getItem(`am_track_${username}`) || '[]');
  return local.map(s => ({
    created_at: new Date(s.ts).toISOString(),
    followers_count: s.followers,
    following_count: s.following,
    posts_count: s.posts,
    engagement_rate: s.er,
  }));
}

/**
 * Migrate localStorage snapshots to Supabase (one-time per account).
 */
export async function migrateLocalSnapshots(userId, username) {
  const key = `am_track_${username}`;
  const local = JSON.parse(localStorage.getItem(key) || '[]');
  if (!local.length) return;

  try {
    const rows = local.map(s => ({
      user_id: userId,
      username,
      followers_count: s.followers || 0,
      following_count: s.following || 0,
      posts_count: s.posts || 0,
      engagement_rate: s.er || 0,
      created_at: new Date(s.ts).toISOString(),
    }));

    const { error } = await supabase
      .from('account_snapshots')
      .upsert(rows, { onConflict: 'user_id,username,created_at' });

    if (error) throw error;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('migrateLocalSnapshots: migration skipped', err.message);
  }
}

/**
 * localStorage fallback for non-logged-in users (preserves original behavior).
 */
export function saveSnapshotLocal(username, data) {
  if (!username) return;
  const key = `am_track_${username}`;
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  const now = Date.now();
  if (history.length > 0 && now - history[history.length - 1].ts < 3600000) return;
  history.push({
    ts: now,
    followers: data.followers || 0,
    following: data.following || 0,
    posts: data.posts || 0,
    er: data.er || 0,
  });
  if (history.length > 30) history.splice(0, history.length - 30);
  localStorage.setItem(key, JSON.stringify(history));
}

export function getSnapshotsLocal(username) {
  if (!username) return [];
  return JSON.parse(localStorage.getItem(`am_track_${username}`) || '[]');
}
