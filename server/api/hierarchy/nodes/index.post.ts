// server/api/hierarchy/nodes/index.post.ts
import { z } from 'zod'
import { db, tables } from '../../../../server/utils/database'
import { eq } from 'drizzle-orm'
import { assertNodeManagementAccess } from '../../../utils/permissions'
import { writeAuditLog } from '../../../utils/audit'

const createNodeSchema = z.object({
  levelId: z.number().int().positive(),
  parentId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const body = await readValidatedBody(event, createNodeSchema.parse)

  // Verify that the level belongs to the organization
  const level = await db.query.hierarchyLevels.findFirst({
    where: eq(tables.hierarchyLevels.id, body.levelId),
  })
  if (!level || level.organizationId !== orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid level ID' })
  }

  // If parentId is provided, verify it belongs to the organization and is a valid parent
  if (body.parentId) {
    const parent = await db.query.hierarchyNodes.findFirst({
      where: eq(tables.hierarchyNodes.id, body.parentId),
    })
    if (!parent || parent.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid parent ID' })
    }
    await assertNodeManagementAccess(session.user.id, orgId, parent.id)
    const parentLevel = await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, parent.levelId) })
    if (!parentLevel || parentLevel.order >= level.order) {
      throw createError({ statusCode: 400, statusMessage: 'A child node must be at a lower hierarchy level than its parent' })
    }
  } else if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only organization-wide administrators can create root hierarchy nodes' })
  }

  // Create the node
  const [node] = await db.insert(tables.hierarchyNodes).values({
    organizationId: orgId,
    levelId: body.levelId,
    parentId: body.parentId || null,
    name: body.name,
  }).returning() as any[] // ✅ Fix: cast to any[]

  if (!node) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create node' })
  }
  await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: 'hierarchy_node.created', entityType: 'hierarchy_node', entityId: node.id, targetLabel: node.name, scope: { type: 'node', id: node.id }, details: `Level: ${level.name}` })

  return { success: true, node }
})
