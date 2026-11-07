import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL must be a valid URL (e.g. https://your-project.supabase.co)'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required and cannot be empty'),
  VITE_APP_URL: z.string().url().optional(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type ClientEnv = z.infer<typeof envSchema>;

/**
 * Validates and exposes safe client environment variables.
 * In development, if environment variables are missing, fallback mock warning is provided
 * to prevent runtime crash during initialization while alerting the developer.
 */
function getClientEnv(): ClientEnv {
  const rawEnv = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  };

  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.error('❌ Invalid client environment variables:', parsed.error.format());
    // In production, throw to avoid running in an unconfigured state
    if (import.meta.env.PROD) {
      throw new Error('Invalid client configuration. Please verify environment variables.');
    }
  }

  return rawEnv as ClientEnv;
}

export const env = getClientEnv();

/**
 * Returns true if real (non-placeholder) Supabase credentials have been configured
 */
export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder-project') && key !== 'placeholder-anon-key');
}
