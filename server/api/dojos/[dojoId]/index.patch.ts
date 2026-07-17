import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess, assertNodeManagementAccess } from '../../../utils/permissions'
import { assertDojoTerritory, getSubscription } from '../../../utils/subscription'

const updateDojoSchema = z.object({
  nodeId: z.number().int().positive().optional(),
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateProvince: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
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
  await assertDojoTerritory(session.user.organizationId!, { city: body.city ?? existing.city, stateProvince: body.stateProvince ?? existing.stateProvince, country: body.country ?? existing.country })

  if (body.nodeId) {
    const node = await db.query.hierarchyNodes.findFirst({
      where: eq(tables.hierarchyNodes.id, body.nodeId),
    })
    if (!node || node.organizationId !== session.user.organizationId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid node ID' })
    }
    const { plan } = await getSubscription(session.user.organizationId!)
    // An existing operational dojo is stored on its own Dojo node. Retain
    // that node when editing details; only a deliberate location change must
    // target a City/Town or Branch node.
    if (['state-pro', 'national'].includes(plan) && body.nodeId !== existing.nodeId) {
      const nodeLevel = await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, node.levelId) })
      if (!nodeLevel || !['City / Town', 'Branch'].includes(nodeLevel.name)) throw createError({ statusCode: 400, statusMessage: 'Choose a City/Town or Branch location for this dojo.' })
    }
    await assertNodeManagementAccess(session.user.id, session.user.organizationId!, body.nodeId)
  }
  if (body.defaultFeePlanId) {
    const plan = await db.query.feePlans.findFirst({ where: and(eq(tables.feePlans.id, body.defaultFeePlanId), eq(tables.feePlans.organizationId, session.user.organizationId!)) })
    if (!plan) throw createError({ statusCode: 400, statusMessage: 'Invalid default fee plan' })
  }

  const [updated] = await db.update(tables.dojos)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(tables.dojos.id, Number(dojoId)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update dojo' })
  }

  return { success: true, dojo: updated }
})
