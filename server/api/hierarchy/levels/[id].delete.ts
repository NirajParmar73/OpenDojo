import { db, tables } from '../../../../server/utils/database'
import { eq } from 'drizzle-orm'
import { assertFederationManagementAccess } from '../../../utils/subscription'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Only owners/admins can delete
  if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  // Optional: check if the level belongs to the user's organization
  const existing = await db.query.hierarchyLevels.findFirst({
    where: eq(tables.hierarchyLevels.id, Number(id)),
  })
  if (!existing || existing.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Level not found' })
  }
  await assertFederationManagementAccess(session.user.organizationId)

  const [deleted] = await db.delete(tables.hierarchyLevels)
    .where(eq(tables.hierarchyLevels.id, Number(id)))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Level not found' })
  }

  return { success: true }
})
