import { and, eq } from 'drizzle-orm'
import { db, tables } from '../utils/database'
import { isPlatformAdminEmail } from '../utils/platform-admin'

/**
 * Stateless sessions need a server-side check so deleted, suspended, and
 * reassigned accounts lose access immediately on their next API request.
 */
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/') || event.path.startsWith('/api/auth/') || event.path.startsWith('/api/platform/')) return

  const session = await getUserSession(event)
  if (!session?.user?.id) return

  const user = await db.query.users.findFirst({ where: eq(tables.users.id, session.user.id) })
  if (!user || user.role !== session.user.role || user.organizationId !== session.user.organizationId) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Your account permissions changed. Please sign in again.' })
  }

  if (!user.organizationId) return
  const organization = await db.query.organizations.findFirst({
    where: and(eq(tables.organizations.id, user.organizationId), eq(tables.organizations.subscriptionStatus, 'suspended')),
    columns: { id: true },
  })
  if (organization && !isPlatformAdminEmail(user.email)) {
    await clearUserSession(event)
    throw createError({ statusCode: 403, statusMessage: 'This organization has been suspended. Contact support.' })
  }
})
