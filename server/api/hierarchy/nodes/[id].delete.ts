// server/api/hierarchy/nodes/[id].delete.ts
import { db, tables } from '../../../../server/utils/database'
import { eq, and } from 'drizzle-orm'
import { assertHierarchyNodeModificationAccess } from '../../../utils/permissions'
import { writeAuditLog } from '../../../utils/audit'
import { assertFederationManagementAccess } from '../../../utils/subscription'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  // Check if the node belongs to the user's organization
  const existing = await db.query.hierarchyNodes.findFirst({
    where: and(
      eq(tables.hierarchyNodes.id, Number(id)),
      eq(tables.hierarchyNodes.organizationId, session.user.organizationId!)
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }
  await assertHierarchyNodeModificationAccess(session.user.id, session.user.organizationId!, existing.id)
  await assertFederationManagementAccess(session.user.organizationId!)

  // Optional: Check if node has children – prevent deletion if so
  const children = await db.query.hierarchyNodes.findMany({
    where: eq(tables.hierarchyNodes.parentId, Number(id)),
  })
  if (children.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete node with children. Delete children first.',
    })
  }

  // ✅ Fix: use `as any` to bypass TypeScript union issue
  const [deleted] = await db.delete(tables.hierarchyNodes)
    .where(eq(tables.hierarchyNodes.id, Number(id)))
    .returning() as any[]

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }
  await writeAuditLog({ organizationId: session.user.organizationId!, actorUserId: session.user.id, action: 'hierarchy_node.deleted', entityType: 'hierarchy_node', entityId: deleted.id, targetLabel: deleted.name, scope: existing.parentId ? { type: 'node', id: existing.parentId } : { type: 'organization' } })

  return { success: true }
})
