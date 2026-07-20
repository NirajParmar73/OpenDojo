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

  const assignments = !body.dojoId && session.user.role !== 'owner'
    ? await db.query.assignments.findMany({ where: eq(tables.assignments.userId, session.user.id) })
    : []
  const territoryRoleOrder = ['country_head', 'state_head', 'district_head', 'city_head', 'zone_head']
  const territoryAssignments = assignments
    .filter(assignment => assignment.scopeType === 'node' && territoryRoleOrder.includes(assignment.role))
  const highestTerritoryRoleIndex = Math.min(...territoryAssignments.map(assignment => territoryRoleOrder.indexOf(assignment.role)))
  const territoryNodeIds = [...new Set(territoryAssignments
    .filter(assignment => territoryRoleOrder.indexOf(assignment.role) === highestTerritoryRoleIndex)
    .map(assignment => assignment.scopeId))]
  if (!body.dojoId && session.user.role !== 'owner' && territoryNodeIds.length !== 1) {
    throw createError({ statusCode: 403, statusMessage: 'A territory-wide plan requires one assigned hierarchy territory.' })
  }
  if (territoryNodeIds.length === 1) {
    const scopeNode = await db.query.hierarchyNodes.findFirst({ where: eq(tables.hierarchyNodes.id, territoryNodeIds[0]) })
    if (!scopeNode || scopeNode.organizationId !== orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Your assigned fee-plan territory is invalid.' })
    }
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
    scopeNodeId: body.dojoId ? null : (session.user.role === 'owner' ? null : territoryNodeIds[0]),
    description: body.description || null,
    isActive: body.isActive ? 1 : 0
  }).returning()

  if (!feePlan) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create fee plan' })
  }

  return { success: true, feePlan }
})
