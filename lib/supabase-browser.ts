import { createClient } from '@supabase/supabase-js'

// Anon (public-key) Supabase client for browser/client components and the
// auth-callback route. Subject to row-level security — it can only touch rows
// the signed-in user is allowed to, so it is safe to ship in the client
// bundle. Shared single instance to avoid re-creating a client per component.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
