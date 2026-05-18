import { createClient } from '@supabase/supabase-js';

// Vite inlines VITE_ env vars at build time.
// Fallback to placeholder values so the app renders even before env vars are configured —
// auth calls will simply fail gracefully until real values are provided in Vercel settings.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
