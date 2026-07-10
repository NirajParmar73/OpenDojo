import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  // Verify ownership
  const existing = await db.query.dojos.findFirst({
    where: eq(tables.dojos.id, Number(id)),
  })
  if (!existing || existing.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  const [deleted] = await db.delete(tables.dojos)
    .where(eq(tables.dojos.id, Number(id)))
    .returning() as any[]

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  return { success: true }
})