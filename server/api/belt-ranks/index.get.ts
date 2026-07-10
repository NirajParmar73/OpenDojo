import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Get the belt system for this organization
  const system = await db.query.beltSystems.findFirst({
    where: eq(tables.beltSystems.organizationId, orgId),
  })
  if (!system) {
    return [] // no system yet
  }

  const ranks = await db.query.beltRanks.findMany({
    where: eq(tables.beltRanks.systemId, system.id),
    orderBy: (ranks, { asc }) => [asc(ranks.order)],
  })

  return ranks
})