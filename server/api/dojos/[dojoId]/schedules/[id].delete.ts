import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dojoId = getRouterParam(event, 'dojoId')
  const scheduleId = getRouterParam(event, 'id')
  if (!dojoId || !scheduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify dojo belongs to organization
  const dojo = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, orgId)
    ),
  })
  if (!dojo) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  // Verify schedule exists
  const existing = await db.query.dojoSchedules.findFirst({
    where: and(
      eq(tables.dojoSchedules.id, Number(scheduleId)),
      eq(tables.dojoSchedules.dojoId, Number(dojoId))
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })
  }

  await db.delete(tables.dojoSchedules)
    .where(eq(tables.dojoSchedules.id, Number(scheduleId)))

  return { success: true }
})