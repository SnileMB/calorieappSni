/**
 * Client env var contract. Fails loudly at module load if a required
 * VITE_ prefixed variable is missing, rather than letting a partially
 * configured Supabase client fail mysteriously later (e.g. with a 401).
 */

function requireEnvVar(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy .env.example to .env and fill in your Supabase project values.',
    )
  }
  return value
}

export const SUPABASE_URL = requireEnvVar('VITE_SUPABASE_URL')
export const SUPABASE_ANON_KEY = requireEnvVar('VITE_SUPABASE_ANON_KEY')
