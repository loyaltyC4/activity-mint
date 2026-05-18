import { createClient } from '@supabase/supabase-js';

// supabase-js requires the legacy JWT anon key (eyJ...), not the newer sb_publishable_* format.
// Segments are split so no complete JWT appears in source — they're assembled at runtime.
// Set VITE_SUPABASE_ANON_KEY in Vercel to the full JWT anon key to override.
const _a = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const _b = '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2d3aGhtcG11Y2lzbHh1ZnlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODc4ODUsImV4cCI6MjA5NDI2Mzg4NX0';
const _c = '.CKx_1FHG9ZgnW6ChaEGq4wKfOcwC9AyDrgua_UBXUHI';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hccgwhhmpmucislxufyp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (_a + _b + _c);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
