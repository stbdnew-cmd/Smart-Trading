import { createClient } from '@supabase/supabase-js';

// Fallback values so client never crashes in environments (like Vercel/Netlify) where env vars are not set
const DEFAULT_SUPABASE_URL = 'https://txonlwaldbqybcywauuz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4b25sd2FsZGJxeWJjeXdhdXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NTY2NzgsImV4cCI6MjEwNTEzMjY3OH0.SsIdj3oD6feLoS5v6kHwToo7Ex_Vr62e0jlKYeHvilo';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL.trim() !== '')
  ? import.meta.env.VITE_SUPABASE_URL
  : DEFAULT_SUPABASE_URL;

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_SUPABASE_ANON_KEY.trim() !== '')
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
