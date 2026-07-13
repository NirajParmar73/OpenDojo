import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { assertDojoManagementAccess } from '../../utils/permissions'

const createFeePlanSchema = z.object({
  name: z.string().min(1),
  amount: z.number().int().positive(),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one-time']).default('monthly'),
  dojoId: z.number().int().positive().nullable().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
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

  const body = await readValidatedBody(event, createFeePlanSchema.parse)

  if (session.user.role !== 'owner' && !body.dojoId) {
    throw createError({ statusCode: 403, statusMessage: 'Choose a dojo. Only the organization owner can create organization-wide fee plans.' })
  }

  // If dojoId is provided, verify it belongs to the organization
  if (body.dojoId) {
    const dojo = await db.query.dojos.findFirst({
      where: eq(tables.dojos.id, body.dojoId)
    })
    if (!dojo || dojo.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
    }
    await assertDojoManagementAccess(session.user.id, orgId, dojo.id)
  }

  const [feePlan] = await db.insert(tables.feePlans).values({
    organizationId: orgId,
    name: body.name,
    amount: body.amount,
    frequency: body.frequency,
    dojoId: body.dojoId || null,
    description: body.description || null,
    isActive: body.isActive ? 1 : 0
  }).returning()

  if (!feePlan) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create fee plan' })
  }

  return { success: true, feePlan }
})
