import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'

const updateDojoSchema = z.object({
  nodeId: z.number().int().positive().optional(),
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
})

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

  const body = await readValidatedBody(event, updateDojoSchema.parse)

  // Check ownership
  const existing = await db.query.dojos.findFirst({
    where: eq(tables.dojos.id, Number(id)),
  })
  if (!existing || existing.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  // If nodeId provided, verify it belongs to the organization
  if (body.nodeId) {
    const node = await db.query.hierarchyNodes.findFirst({
      where: eq(tables.hierarchyNodes.id, body.nodeId),
    })
    if (!node || node.organizationId !== session.user.organizationId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid node ID' })
    }
  }

  const [updated] = await db.update(tables.dojos)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(tables.dojos.id, Number(id)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update dojo' })
  }

  return { success: true, dojo: updated }
})