import { db, tables } from '../../utils/database'
import { and, eq, inArray } from 'drizzle-orm'
import { getAccessibleDojoIds } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const accessibleDojos = await getAccessibleDojoIds(session.user.id, orgId)
  if (accessibleDojos !== null && !accessibleDojos.length) return []

  const feePlans = await db.query.feePlans.findMany({
    where: accessibleDojos === null
      ? eq(tables.feePlans.organizationId, orgId)
      : and(eq(tables.feePlans.organizationId, orgId), inArray(tables.feePlans.dojoId, accessibleDojos)),
    with: {
      dojo: true // include dojo details if linked
    },
    orderBy: (plans, { asc }) => [asc(plans.name)]
  })

  return feePlans
})
