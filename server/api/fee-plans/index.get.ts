import { db, tables } from '../../utils/database'
import { eq, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Only owner/admin can view fee plans (you can extend to finance role later)
  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const feePlans = await db.query.feePlans.findMany({
    where: eq(tables.feePlans.organizationId, orgId),
    with: {
      dojo: true, // include dojo details if linked
    },
    orderBy: (plans, { asc }) => [asc(plans.name)],
  })

  return feePlans
})