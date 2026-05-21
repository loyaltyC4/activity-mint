import { supabase } from './supabase';

/**
 * Get digest preferences for a user.
 */
export async function getDigestPreferences(userId) {
  try {
    const { data, error } = await supabase
      .from('digest_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
  } catch (err) {
    console.warn('getDigestPreferences: table may not exist', err.message);
    return null;
  }
}

/**
 * Create or update digest preferences.
 */
export async function upsertDigestPreferences(userId, prefs) {
  const { data, error } = await supabase
    .from('digest_preferences')
    .upsert({
      user_id: userId,
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
