import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

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

  // Fetch the rank with its system
  const rank = await db.query.beltRanks.findFirst({
    where: eq(tables.beltRanks.id, Number(id)),
    with: { system: true },
  }) as any // 👈 cast to any to bypass type inference

  if (!rank) {
    throw createError({ statusCode: 404, statusMessage: 'Rank not found' })
  }

  // Check that the system belongs to the organization
  if (rank.system.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Rank not found' })
  }

  await db.delete(tables.beltRanks)
    .where(eq(tables.beltRanks.id, Number(id)))

  return { success: true }
})