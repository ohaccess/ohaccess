import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client. Bypasses row-level security, so it must only
// ever run on the server. The `server-only` import above turns an accidental
// import from a client component into a build error instead of a leaked
// service-role key. Every API route, cron job, webhook, and server component
// that needs full database access imports this single shared instance.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
