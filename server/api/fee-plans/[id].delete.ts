import { db, tables } from '../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess, assertNodeManagementAccess } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify fee plan exists and belongs to organization
  const existing = await db.query.feePlans.findFirst({
    where: and(
      eq(tables.feePlans.id, Number(id)),
      eq(tables.feePlans.organizationId, orgId)
    )
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Fee plan not found' })
  }

  if (session.user.role !== 'owner') {
    if (existing.scopeNodeId) {
      await assertNodeManagementAccess(session.user.id, orgId, existing.scopeNodeId)
    } else if (!existing.dojoId) {
      throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can delete organization-wide fee plans.' })
    } else {
      await assertDojoManagementAccess(session.user.id, orgId, existing.dojoId)
    }
  }

  const assignments = await db.query.studentFeeAssignments.findMany({
    where: eq(tables.studentFeeAssignments.feePlanId, Number(id)),
    columns: { id: true },
  })
  if (assignments.length) {
    await db.update(tables.feePlans)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(tables.feePlans.id, Number(id)))
    return { success: true, action: 'archived' }
  }

  await db.delete(tables.feePlans).where(eq(tables.feePlans.id, Number(id)))
  return { success: true, action: 'deleted' }
})
