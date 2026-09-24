// Security stance (RESEARCH.md Security Domain): the anon key below is public
// by design and safe to ship in the client bundle. Row Level Security (RLS)
// policies in Postgres — not secrecy of this key — are the actual
// authorization boundary. The elevated Supabase admin key that bypasses RLS
// must never appear in any file under src/; it belongs only in trusted
// server-side contexts (e.g. GitHub Actions secrets, Edge Functions).
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
