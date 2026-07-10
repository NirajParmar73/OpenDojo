import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'
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

  // If accessibleDojoIds is null (owner/admin), fetch all dojos
  if (accessibleDojoIds === null) {
    const dojos = await db.query.dojos.findMany({
      where: eq(tables.dojos.organizationId, orgId),
      with: { node: true },
    })
    return dojos
  }

  // Otherwise, filter by accessible IDs
  if (accessibleDojoIds.length === 0) {
    return []
  }

  const dojos = await db.query.dojos.findMany({
    where: eq(tables.dojos.organizationId, orgId),
    with: { node: true },
  })
  // Filter in memory (or use inArray)
  return dojos.filter(d => accessibleDojoIds.includes(d.id))
})