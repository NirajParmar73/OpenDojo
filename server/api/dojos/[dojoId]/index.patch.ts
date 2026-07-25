import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess, assertNodeManagementAccess, isDojoWithinHierarchyNode } from '../../../utils/permissions'

const updateDojoSchema = z.object({ nodeId: z.number().int().positive().optional(), name: z.string().min(1).optional(), address: z.string().optional().nullable(), city: z.string().trim().max(100).optional().nullable(), stateProvince: z.string().trim().max(100).optional().nullable(), country: z.string().trim().max(100).optional().nullable(), countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).optional().nullable(), subdivisionCode: z.string().trim().max(20).optional().nullable(), postalCode: z.string().trim().max(20).optional().nullable(), phone: z.string().optional().nullable(), email: z.string().email().optional().nullable(), defaultFeePlanId: z.number().int().positive().nullable().optional() })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const dojoId = Number(getRouterParam(event, 'dojoId'))
  if (!Number.isInteger(dojoId)) throw createError({ statusCode: 400, statusMessage: 'Missing location ID' })
  const body = await readValidatedBody(event, updateDojoSchema.parse)
  const existing = await db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, dojoId), eq(tables.dojos.organizationId, session.user.organizationId)) })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
  await assertDojoManagementAccess(session.user.id, session.user.organizationId, existing.id)
  if (body.nodeId) {
    const node = await db.query.hierarchyNodes.findFirst({ where: eq(tables.hierarchyNodes.id, body.nodeId) })
    if (!node || node.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid group.' })
    await assertNodeManagementAccess(session.user.id, session.user.organizationId, body.nodeId)
  }
  if (body.defaultFeePlanId) {
    const plan = await db.query.feePlans.findFirst({ where: and(eq(tables.feePlans.id, body.defaultFeePlanId), eq(tables.feePlans.organizationId, session.user.organizationId)) })
    if (!plan) throw createError({ statusCode: 400, statusMessage: 'Invalid default fee plan' })
    if (plan.dojoId && plan.dojoId !== existing.id) throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan for this location.' })
    if (plan.scopeNodeId && !await isDojoWithinHierarchyNode(session.user.organizationId, existing.id, plan.scopeNodeId)) throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan for this location group.' })
  }
  const [updated] = await db.update(tables.dojos).set({ ...body, updatedAt: new Date() }).where(eq(tables.dojos.id, dojoId)).returning() as any[]
  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Failed to update location' })
  return { success: true, dojo: updated }
})
