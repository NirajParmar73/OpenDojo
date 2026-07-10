import { db, tables } from '../../../server/utils/database'
import { eq, inArray, and } from 'drizzle-orm'
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

  // Get accessible dojo IDs for this user
  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, orgId)

  // Build the query
  let query = db.query.students.findMany({
    where: eq(tables.students.organizationId, orgId),
    with: {
      dojo: {
        with: {
          node: true,
        },
      },
    },
  })

  // If accessibleDojoIds is null, user has unrestricted access (owner/admin)
  // If it's an empty array, user has no access to any dojo → return empty list
  if (accessibleDojoIds !== null) {
    if (accessibleDojoIds.length === 0) {
      return []
    }
    // Filter students by dojoId in accessibleDojoIds
    query = db.query.students.findMany({
      where: and(
        eq(tables.students.organizationId, orgId),
        inArray(tables.students.dojoId, accessibleDojoIds)
      ),
      with: {
        dojo: {
          with: {
            node: true,
          },
        },
      },
    })
  }

  const students = await db.query.students.findMany({
  where: eq(tables.students.organizationId, orgId),
  with: {
    dojo: { with: { node: true } },
    currentBeltRank: true, // 👈 add this
  },
})
  return students
})