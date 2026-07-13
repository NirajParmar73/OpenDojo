import { db, tables } from '../../utils/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify fee plan exists and belongs to organization
  const existing = await db.query.feePlans.findFirst({
    where: and(
      eq(tables.feePlans.id, Number(id)),
      eq(tables.feePlans.organizationId, orgId)
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Fee plan not found' })
  }

  // Optional: check if there are any active student assignments before deleting?
  // We'll allow deletion; if assignments exist, they become orphaned, but we can handle that.

  await db.delete(tables.feePlans)
    .where(eq(tables.feePlans.id, Number(id)))

  return { success: true }
})
