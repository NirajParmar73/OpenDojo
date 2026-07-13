import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getAllowedAssignmentsForCreator, getHierarchyManagementScope } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  const id = Number(getRouterParam(event, 'id'))
  if (!orgId || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user request' })
  }

  const user = await db.query.users.findFirst({
    where: and(eq(tables.users.id, id), eq(tables.users.organizationId, orgId)),
    with: { assignments: true },
  })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  if (session.user.role !== 'owner') {
    const allowed = await getAllowedAssignmentsForCreator(session.user.id, orgId)
    const managementScope = await getHierarchyManagementScope(session.user.id, orgId)
    const inTerritory = user.assignments.some(assignment => (
      assignment.scopeType === 'node'
        ? (user.id === session.user.id ? managementScope.managedParentNodeIds : allowed.allowedNodeIds).includes(assignment.scopeId)
        : allowed.allowedDojoIds.includes(assignment.scopeId)
    ))
    if (!inTerritory) throw createError({ statusCode: 403, statusMessage: 'This staff member is outside your assigned territory' })
  }

  const { passwordHash, ...safeUser } = user
  return safeUser
})
