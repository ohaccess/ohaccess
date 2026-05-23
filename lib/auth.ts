import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}
