import { db, tables } from '../../../server/utils/database'
import { and, eq, inArray } from 'drizzle-orm'
import { getAccessibleDojoIds } from '../../../server/utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, orgId)
  if (accessibleDojoIds !== null && accessibleDojoIds.length === 0) {
    return []
  }

  return db.query.students.findMany({
    where: accessibleDojoIds === null
      ? eq(tables.students.organizationId, orgId)
      : and(
          eq(tables.students.organizationId, orgId),
          inArray(tables.students.dojoId, accessibleDojoIds)
        ),
    with: {
      dojo: { with: { node: true } },
      currentBeltRank: true,
    },
  })
})
