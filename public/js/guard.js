import { supabase } from '/js/supabaseClient.js';

export async function redirectIfLoggedIn() {
  const { data } = await supabase.auth.getSession();
  if (data.session) window.location.replace('/browse');
}

export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.replace('/login');
    return null;
  }
  return data.session;
}