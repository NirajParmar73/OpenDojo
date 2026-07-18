import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'
import { canDeleteManagedUser, canEditManagedUser, canViewManagedUser, getAllowedAssignmentsForCreator } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }


  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }
  const allowed = await getAllowedAssignmentsForCreator(session.user.id, orgId)
  if (session.user.role !== 'owner' && allowed.allowedNodeIds.length === 0 && allowed.allowedDojoIds.length === 0) throw createError({ statusCode: 403, statusMessage: 'No staff management territory is assigned to this account' })

  const users = await db.query.users.findMany({
  where: eq(tables.users.organizationId, orgId),
  with: {
    assignments: true, // only assignments, no nested scope names for now
  },
})

  // For each assignment, fetch scope name
  const scopedUsers = users.filter(user => canViewManagedUser(session.user.id, session.user.role, user, allowed))
  const usersWithAssignments = await Promise.all(
    scopedUsers.map(async (user) => {
      const assignmentsWithScope = await Promise.all(
        user.assignments.map(async (assignment) => {
          let scopeName = null
          if (assignment.scopeType === 'node') {
            const node = await db.query.hierarchyNodes.findFirst({
              where: eq(tables.hierarchyNodes.id, assignment.scopeId),
            })
            scopeName = node?.name || null
          } else if (assignment.scopeType === 'dojo') {
            const dojo = await db.query.dojos.findFirst({
              where: eq(tables.dojos.id, assignment.scopeId),
            })
            scopeName = dojo?.name || null
          }
          return {
            ...assignment,
            scopeName,
          }
        })
      )
      return {
        ...user,
        assignments: assignmentsWithScope,
        canEdit: canEditManagedUser(session.user.id, session.user.role, user, allowed),
        canDelete: canDeleteManagedUser(session.user.id, session.user.role, user, allowed),
        passwordHash: undefined, // hide password hash
      }
    })
  )

  return usersWithAssignments
})
