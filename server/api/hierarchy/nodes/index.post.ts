// server/api/hierarchy/nodes/index.post.ts
import { z } from 'zod'
import { db, tables } from '../../../../server/utils/database'
import { eq } from 'drizzle-orm'

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

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
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
    // Optional: ensure parent's level order is less than current level's order
    // (to enforce hierarchy order)
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

  return { success: true, node }
})