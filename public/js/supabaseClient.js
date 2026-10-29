import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = window.__ACHIEVERS_ENV__ || {};
if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing Supabase config. Did /env.js load?');
}
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});