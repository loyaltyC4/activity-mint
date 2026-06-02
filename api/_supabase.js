/**
 * api/_supabase.js — shared Supabase helpers for all carousel API routes.
 *
 * Uses the user's own JWT (passed as Authorization: Bearer <token>) to create
 * a user-scoped Supabase client. This means:
 *   - RLS policies see auth.uid() = the real user's UUID
 *   - No service role key is needed — the public anon key is sufficient
 *   - Every DB operation is automatically scoped to the requesting user
 *
 * The URL and anon key are already public in the frontend codebase (supabase.js).
 * Hardcoding them here is safe and avoids any new Vercel env var requirement.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://hccgwhhmpmucislxufyp.supabase.co'
// Public anon key — safe to commit (already in src/lib/supabase.js)
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2d3aGhtcG11Y2lzbHh1ZnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODc4ODUsImV4cCI6MjA5NDI2Mzg4NX0' +
  '.CKx_1FHG9ZgnW6ChaEGq4wKfOcwC9AyDrgua_UBXUHI'

/**
 * Verify the bearer token and return a user-scoped Supabase client.
 *
 * The returned client has auth.uid() = user.id for every query, so all
 * RLS policies (using auth.uid() = user_id) work without a service role key.
 *
 * Returns null if the token is missing or invalid.
 */
export async function getUserClient(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return null

  // Build a client that impersonates the user via their JWT
  const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false },
  })

  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null

  return { user, db: client }
}
