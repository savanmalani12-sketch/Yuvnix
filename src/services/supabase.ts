import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env, isSupabaseConfigured } from '@/utils/env';

/**
 * Type-safe Supabase client configured strictly with public anon credentials.
 * Row Level Security (RLS) policies on the PostgreSQL database enforce access control.
 *
 * ENGINEERING RULE: Service-role keys must NEVER be exposed or stored on the frontend.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Initiates Google OAuth authentication flow.
 * Per product rules, Google OAuth is the primary student authentication provider.
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return {
      error: new Error(
        'Supabase is not configured yet. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
      ),
    };
  }

  const redirectTo = `${window.location.origin}/auth/callback`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  return { error };
}

/**
 * Signs the current student or staff member out.
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}
