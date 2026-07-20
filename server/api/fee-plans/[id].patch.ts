import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess, assertNodeManagementAccess } from '../../utils/permissions'

const updateFeePlanSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().int().positive().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one-time']).optional(),
  dojoId: z.number().int().positive().nullable().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional()
})

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

  const body = await readValidatedBody(event, updateFeePlanSchema.parse)

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
      throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can edit organization-wide fee plans.' })
    } else {
      await assertDojoManagementAccess(session.user.id, orgId, existing.dojoId)
    }
    if (body.dojoId === null && existing.dojoId) throw createError({ statusCode: 403, statusMessage: 'Create a new blank-dojo plan to apply it across your territory.' })
  }

  // If dojoId is provided, verify it belongs to the organization
  if (body.dojoId !== undefined && body.dojoId !== null) {
    const dojo = await db.query.dojos.findFirst({
      where: eq(tables.dojos.id, body.dojoId)
    })
    if (!dojo || dojo.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
    }
    await assertDojoManagementAccess(session.user.id, orgId, dojo.id)
  }

  const updateData: Partial<typeof tables.feePlans.$inferInsert> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.amount !== undefined) updateData.amount = body.amount
  if (body.frequency !== undefined) updateData.frequency = body.frequency
  if (body.dojoId !== undefined) updateData.dojoId = body.dojoId
  if (body.description !== undefined) updateData.description = body.description
  if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0
  updateData.updatedAt = new Date()

  const [updated] = await db.update(tables.feePlans)
    .set(updateData)
    .where(eq(tables.feePlans.id, Number(id)))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update fee plan' })
  }

  return { success: true, feePlan: updated }
})
