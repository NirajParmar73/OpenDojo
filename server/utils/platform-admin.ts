import type { H3Event } from 'h3'

/**
 * Platform access is deliberately separate from an organization `owner` role.
 * Configure one or more comma-separated addresses in PLATFORM_ADMIN_EMAILS.
 */
export function isPlatformAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const allowedEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  return allowedEmails.includes(email.trim().toLowerCase())
}

export async function requirePlatformAdmin(event: H3Event) {
  const session = await getUserSession(event)
  if (!session?.user || !isPlatformAdminEmail(session.user.email)) {
    throw createError({ statusCode: 403, statusMessage: 'Platform administrator access required' })
  }
  return session
}
