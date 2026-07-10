import { db, tables } from '../../../../server/utils/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized – please log in' })
  }

  // ✅ Guard: organizationId must exist
  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const levels = await db.query.hierarchyLevels.findMany({
    where: eq(tables.hierarchyLevels.organizationId, orgId),
    orderBy: (levels, { asc }) => [asc(levels.order)],
  })

  return levels
})