import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getAllowedAssignmentsForCreator } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid affiliation' })

  const organizationId = session.user.organizationId
  const affiliation = await db.query.affiliations.findFirst({ where: and(eq(tables.affiliations.id, id), eq(tables.affiliations.organizationId, organizationId)) })
  if (!affiliation) throw createError({ statusCode: 404, statusMessage: 'Affiliation not found' })

  if (session.user.role !== 'owner') {
    const allowed = await getAllowedAssignmentsForCreator(session.user.id, organizationId)
    const inTerritory = (affiliation.scopeType === 'node' && affiliation.scopeId && allowed.allowedNodeIds.includes(affiliation.scopeId)) || (affiliation.scopeType === 'dojo' && affiliation.scopeId && allowed.allowedDojoIds.includes(affiliation.scopeId))
    if (!inTerritory) throw createError({ statusCode: 403, statusMessage: 'This affiliation is outside your assigned territory' })
  }

  await db.delete(tables.affiliations).where(eq(tables.affiliations.id, id))
  return { success: true }
})
