import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess, assertNodeManagementAccess, isDojoWithinHierarchyNode } from '../../../utils/permissions'
import { assertDojoTerritory, getSubscription } from '../../../utils/subscription'
import { getLocationFromHierarchyNode } from '../../../utils/hierarchy-location'

const updateDojoSchema = z.object({
  nodeId: z.number().int().positive().optional(),
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateProvince: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).optional().nullable(),
  subdivisionCode: z.string().trim().max(20).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  defaultFeePlanId: z.number().int().positive().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }


  const dojoId = getRouterParam(event, 'dojoId')
  if (!dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const body = await readValidatedBody(event, updateDojoSchema.parse)

  const existing = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, session.user.organizationId!)
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }
  await assertDojoManagementAccess(session.user.id, session.user.organizationId!, existing.id)
  const { plan: subscriptionPlan } = await getSubscription(session.user.organizationId!)
  const targetNodeId = body.nodeId || existing.nodeId
  const hierarchyLocation = await getLocationFromHierarchyNode(session.user.organizationId!, targetNodeId, subscriptionPlan === 'national')
  const location = {
    city: hierarchyLocation.city || body.city || existing.city,
    stateProvince: hierarchyLocation.stateProvince || body.stateProvince || existing.stateProvince,
    country: hierarchyLocation.country || body.country || existing.country,
    countryCode: hierarchyLocation.countryCode || body.countryCode || existing.countryCode,
    subdivisionCode: hierarchyLocation.subdivisionCode || body.subdivisionCode || existing.subdivisionCode,
    postalCode: hierarchyLocation.postalCode || body.postalCode || existing.postalCode,
  }
  await assertDojoTerritory(session.user.organizationId!, location)

  if (body.nodeId) {
    const node = await db.query.hierarchyNodes.findFirst({
      where: eq(tables.hierarchyNodes.id, body.nodeId),
    })
    if (!node || node.organizationId !== session.user.organizationId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid node ID' })
    }
    // An existing operational dojo is stored on its own Dojo node. Retain
    // that node when editing details; only a deliberate location change must
    // target a City/Town or Branch node.
    if (['state-pro', 'national'].includes(subscriptionPlan) && body.nodeId !== existing.nodeId) {
      const nodeLevel = await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, node.levelId) })
      if (!nodeLevel || !['City / Town', 'Branch'].includes(nodeLevel.name)) throw createError({ statusCode: 400, statusMessage: 'Choose a City/Town or Branch location for this dojo.' })
    }
    await assertNodeManagementAccess(session.user.id, session.user.organizationId!, body.nodeId)
  }
  if (body.defaultFeePlanId) {
    const plan = await db.query.feePlans.findFirst({ where: and(eq(tables.feePlans.id, body.defaultFeePlanId), eq(tables.feePlans.organizationId, session.user.organizationId!)) })
    if (!plan) throw createError({ statusCode: 400, statusMessage: 'Invalid default fee plan' })
    if (plan.dojoId && plan.dojoId !== existing.id) throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan for this dojo.' })
    if (plan.scopeNodeId && !await isDojoWithinHierarchyNode(session.user.organizationId!, existing.id, plan.scopeNodeId)) throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan for this dojo\'s territory.' })
  }

  const [updated] = await db.update(tables.dojos)
    .set({ ...body, ...location, updatedAt: new Date() })
    .where(eq(tables.dojos.id, Number(dojoId)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update dojo' })
  }

  return { success: true, dojo: updated }
})
