import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/** Splitzy's tables live in their own schema so the Supabase project can be shared with other apps. */
export const DB_SCHEMA = 'splitzy';

export const supabase = createClient(url || 'http://localhost:54321', key || 'not-configured', {
  db: { schema: DB_SCHEMA },
  auth: {
    // PKCE returns `?code=` in the query string, which doesn't clash with hash-based routes.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** The app's URL without query or hash — used as the redirect target for auth emails. */
export const appUrl = () => `${window.location.origin}${window.location.pathname}`;
