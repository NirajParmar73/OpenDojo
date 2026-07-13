import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../server/utils/database'
import { assertHierarchyNodeModificationAccess } from '../../../utils/permissions'
import { writeAuditLog } from '../../../utils/audit'

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  levelId: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing node ID' })
  const orgId = session.user.organizationId
  const node = await db.query.hierarchyNodes.findFirst({ where: and(eq(tables.hierarchyNodes.id, id), eq(tables.hierarchyNodes.organizationId, orgId)) })
  if (!node) throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  await assertHierarchyNodeModificationAccess(session.user.id, orgId, id)

  const body = await readValidatedBody(event, updateNodeSchema.parse)
  if (body.levelId && body.levelId !== node.levelId) {
    const level = await db.query.hierarchyLevels.findFirst({ where: and(eq(tables.hierarchyLevels.id, body.levelId), eq(tables.hierarchyLevels.organizationId, orgId)) })
    if (!level) throw createError({ statusCode: 400, statusMessage: 'Invalid hierarchy level' })
    if (node.parentId) {
      const parent = await db.query.hierarchyNodes.findFirst({ where: eq(tables.hierarchyNodes.id, node.parentId) })
      const parentLevel = parent && await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, parent.levelId) })
      if (parentLevel && parentLevel.order >= level.order) throw createError({ statusCode: 400, statusMessage: 'A child node must be at a lower hierarchy level than its parent' })
    }
  }
  const [updated] = await db.update(tables.hierarchyNodes).set({ ...body, updatedAt: new Date() }).where(eq(tables.hierarchyNodes.id, id)).returning()
  await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: 'hierarchy_node.updated', entityType: 'hierarchy_node', entityId: id, targetLabel: updated?.name || node.name, scope: { type: 'node', id }, details: Object.keys(body).join(', ') })
  return { success: true, node: updated }
})
