import { supabaseAdmin as supabase } from './supabase-admin'

export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// Is this email on the admin allowlist (ADMIN_EMAILS, comma-separated)?
// Case-insensitive. Used to gate the /api/admin/* routes.
export function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
