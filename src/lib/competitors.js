import { supabase } from './supabase';

/**
 * Get all competitors tracked by a user.
 */
export async function getCompetitors(userId) {
  try {
    const { data, error } = await supabase
      .from('competitor_tracking')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('getCompetitors: table may not exist', err.message);
    return [];
  }
}

/**
 * Add a competitor to track.
 */
export async function addCompetitor(userId, username) {
  const { data, error } = await supabase
    .from('competitor_tracking')
    .insert({ user_id: userId, username, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Remove a tracked competitor.
 */
export async function removeCompetitor(id) {
  const { error } = await supabase.from('competitor_tracking').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Save a snapshot of competitor metrics.
 */
export async function saveCompetitorSnapshot(competitorId, metrics) {
  try {
    await supabase.from('competitor_snapshots').insert({
      competitor_id: competitorId,
      followers_count: metrics.followers || 0,
      following_count: metrics.following || 0,
      posts_count: metrics.posts || 0,
      engagement_rate: metrics.er || 0,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('saveCompetitorSnapshot: skipped', err.message);
  }
}

/**
 * Get historical snapshots for a competitor.
 */
export async function getCompetitorSnapshots(competitorId) {
  try {
    const { data, error } = await supabase
      .from('competitor_snapshots')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('created_at', { ascending: true })
      .limit(60);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('getCompetitorSnapshots: table may not exist', err.message);
    return [];
  }
}
