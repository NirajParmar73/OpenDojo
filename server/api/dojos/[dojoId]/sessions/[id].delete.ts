import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dojoId = getRouterParam(event, 'dojoId')
  const sessionId = getRouterParam(event, 'id')
  if (!dojoId || !sessionId) {
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

  // Verify session exists and belongs to this dojo
  const existing = await db.query.classSessions.findFirst({
    where: and(
      eq(tables.classSessions.id, Number(sessionId)),
      eq(tables.classSessions.dojoId, Number(dojoId))
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  // Delete the session – attendance records will be cascaded (ON DELETE CASCADE)
  await db.delete(tables.classSessions)
    .where(eq(tables.classSessions.id, Number(sessionId)))

  return { success: true }
})