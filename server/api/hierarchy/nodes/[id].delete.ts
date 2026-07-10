// server/api/hierarchy/nodes/[id].delete.ts
import { db, tables } from '../../../../server/utils/database'
import { eq, and } from 'drizzle-orm'

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

  return { success: true }
})