import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../server/utils/database'
import { assertHierarchyNodeModificationAccess } from '../../../utils/permissions'
import { writeAuditLog } from '../../../utils/audit'
import { assertFederationManagementAccess } from '../../../utils/subscription'

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  levelId: z.number().int().positive().optional(),
  parentId: z.number().int().positive().nullable().optional(),
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
  const targetLevelId = body.levelId || node.levelId
  const targetLevel = await db.query.hierarchyLevels.findFirst({ where: and(eq(tables.hierarchyLevels.id, targetLevelId), eq(tables.hierarchyLevels.organizationId, orgId)) })
  if (!targetLevel) throw createError({ statusCode: 400, statusMessage: 'Invalid hierarchy level' })

  const targetParentId = body.parentId === undefined ? node.parentId : body.parentId
  if (body.parentId !== undefined) await assertFederationManagementAccess(orgId)
  if (targetParentId) {
    if (targetParentId === id) throw createError({ statusCode: 400, statusMessage: 'A node cannot be its own parent.' })
    let currentParentId: number | null = targetParentId
    while (currentParentId) {
      if (currentParentId === id) throw createError({ statusCode: 400, statusMessage: 'A node cannot be moved below one of its descendants.' })
      const parent = await db.query.hierarchyNodes.findFirst({ where: and(eq(tables.hierarchyNodes.id, currentParentId), eq(tables.hierarchyNodes.organizationId, orgId)) })
      if (!parent) throw createError({ statusCode: 400, statusMessage: 'Invalid parent node.' })
      const parentLevel = await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, parent.levelId) })
      if (!parentLevel || parentLevel.order >= targetLevel.order) throw createError({ statusCode: 400, statusMessage: 'A child node must be at a lower hierarchy level than its parent.' })
      currentParentId = parent.parentId
    }
  } else if (body.parentId !== undefined && session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can create root hierarchy nodes.' })
  }

  if (body.levelId && body.levelId !== node.levelId) {
    const children = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.parentId, id) })
    for (const child of children) {
      const childLevel = await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, child.levelId) })
      if (childLevel && childLevel.order <= targetLevel.order) throw createError({ statusCode: 400, statusMessage: 'A parent node must be above all of its children.' })
    }
  }

  const [updated] = await db.update(tables.hierarchyNodes).set({ ...body, updatedAt: new Date() }).where(eq(tables.hierarchyNodes.id, id)).returning()
  await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: 'hierarchy_node.updated', entityType: 'hierarchy_node', entityId: id, targetLabel: updated?.name || node.name, scope: { type: 'node', id }, details: Object.keys(body).join(', ') })
  return { success: true, node: updated }
})
