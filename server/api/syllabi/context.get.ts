import { eq, inArray } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getManageableSyllabusScopes } from '../../utils/syllabus'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const scopes = await getManageableSyllabusScopes(session.user.id, organizationId)
  if (!scopes.length) throw createError({ statusCode: 403, statusMessage: 'You do not have syllabus management access' })
  const systems = await db.query.beltSystems.findMany({ where: eq(tables.beltSystems.organizationId, organizationId) })
  const ranks = systems.length
    ? await db.query.beltRanks.findMany({ where: inArray(tables.beltRanks.systemId, systems.map(system => system.id)), with: { system: true }, orderBy: (rank, { asc }) => [asc(rank.systemId), asc(rank.order)] })
    : []
  return { scopes, ranks }
})
