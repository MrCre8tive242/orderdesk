import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key',
  // stay signed in across visits: session kept in localStorage and refreshed automatically
  { auth: { persistSession: true, autoRefreshToken: true } },
)
