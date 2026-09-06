import { createClient } from '@supabase/supabase-js';

// Fallback values so client never crashes in environments (like Vercel/Netlify) where env vars are not set
const DEFAULT_SUPABASE_URL = 'https://bceonjnxvjsduddydnvh.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_tlmAeJS4xNHpRT1fPD6tLw_yu2DtHWP';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.trim() !== '')
  ? import.meta.env.VITE_SUPABASE_URL
  : DEFAULT_SUPABASE_URL;

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_ANON_KEY.trim() !== '')
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
