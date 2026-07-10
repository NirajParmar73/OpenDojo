import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const dojoId = getRouterParam(event, 'dojoId')
  if (!dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const existing = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, session.user.organizationId!)
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  const [deleted] = await db.delete(tables.dojos)
    .where(eq(tables.dojos.id, Number(dojoId)))
    .returning() as any[]

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  return { success: true }
})