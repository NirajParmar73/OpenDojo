import { db, tables } from '../../../server/utils/database'
import { eq, and } from 'drizzle-orm'
import { canDeleteManagedUser, getAllowedAssignmentsForCreator } from '../../utils/permissions'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  // Check if user exists and belongs to organization
  const existingUser = await db.query.users.findFirst({
    where: and(
      eq(tables.users.id, Number(id)),
      eq(tables.users.organizationId, orgId)
    ),
    with: { assignments: true },
  })
  if (!existingUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const permissions = await getAllowedAssignmentsForCreator(session.user.id, orgId)
  if (!canDeleteManagedUser(session.user.id, session.user.role, existingUser, permissions)) {
    const message = existingUser.role === 'owner'
      ? 'Cannot delete the organization owner'
      : existingUser.role === 'admin'
        ? 'Only the organization owner can delete an admin user'
        : 'This user is outside your manageable hierarchy'
    throw createError({ statusCode: 403, statusMessage: message })
  }

  if (existingUser.role === 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Cannot delete the organization owner' })
  }

  // Soft delete: we could set a deletedAt column, but we haven't added that.
  // For now, we'll physically delete the user and their assignments.
  // Alternatively, we can add a `deletedAt` column.
  await db.delete(tables.assignments)
    .where(eq(tables.assignments.userId, Number(id)))

  await db.delete(tables.users)
    .where(eq(tables.users.id, Number(id)))

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: session.user.id,
    action: 'user.deleted',
    entityType: 'user',
    entityId: existingUser.id,
    targetLabel: existingUser.name,
    scope: { type: 'organization' },
    details: `Deleted by ${session.user.role}.`,
  })

  return { success: true }
})
