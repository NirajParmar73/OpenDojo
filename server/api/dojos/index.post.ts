import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { and, eq } from 'drizzle-orm'
import { assertNodeManagementAccess, getHierarchyManagementScope, getTerritoryLocationDefaults } from '../../utils/permissions'
import { assertDojoLimit } from '../../utils/subscription'

const createDojoSchema = z.object({
  // Optional: an existing group is retained for advanced organisations.
  nodeId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1), address: z.string().optional(), city: z.string().trim().max(100).optional(), stateProvince: z.string().trim().max(100).optional(), country: z.string().trim().max(100).optional(), countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).optional(), subdivisionCode: z.string().trim().max(20).optional(), postalCode: z.string().trim().max(20).optional(), phone: z.string().optional(), email: z.string().email().optional(),
})

async function createLocationNode(organizationId: number, name: string, parentId: number | null) {
  let level = await db.query.hierarchyLevels.findFirst({ where: and(eq(tables.hierarchyLevels.organizationId, organizationId), eq(tables.hierarchyLevels.name, 'Location')) })
  if (!level) {
    const [created] = await db.insert(tables.hierarchyLevels).values({ organizationId, name: 'Location', order: 1 }).returning()
    level = created
  }
  const [node] = await db.insert(tables.hierarchyNodes).values({ organizationId, levelId: level!.id, parentId, name }).returning()
  return node!
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const orgId = session.user.organizationId
  const body = await readValidatedBody(event, createDojoSchema.parse)
  await assertDojoLimit(orgId)

  let nodeId = body.nodeId || null
  if (nodeId) {
    const node = await db.query.hierarchyNodes.findFirst({ where: eq(tables.hierarchyNodes.id, nodeId) })
    if (!node || node.organizationId !== orgId) throw createError({ statusCode: 400, statusMessage: 'Invalid group.' })
    await assertNodeManagementAccess(session.user.id, orgId, nodeId)
  } else {
    // The database continues to receive a node ID, without exposing hierarchy
    // setup to the user. A delegated manager's location is created below the
    // first group they are allowed to manage, never at the organization root.
    // Existing nodes and their relationships are untouched.
    const scope = await getHierarchyManagementScope(session.user.id, orgId)
    const parentId = session.user.role === 'owner' ? null : scope.managedParentNodeIds[0] || null
    if (session.user.role !== 'owner' && !parentId) throw createError({ statusCode: 403, statusMessage: 'No location group is assigned to this account.' })
    nodeId = (await createLocationNode(orgId, body.name, parentId)).id
    await assertNodeManagementAccess(session.user.id, orgId, nodeId)
  }

  const territoryDefaults = session.user.role === 'owner' ? {} : await getTerritoryLocationDefaults(session.user.id, orgId)
  const [dojo] = await db.insert(tables.dojos).values({ organizationId: orgId, nodeId, name: body.name, address: body.address || null, city: territoryDefaults.city || body.city || null, stateProvince: territoryDefaults.stateProvince || body.stateProvince || null, country: territoryDefaults.country || body.country || null, countryCode: body.countryCode || null, subdivisionCode: body.subdivisionCode || null, postalCode: body.postalCode || null, phone: body.phone || null, email: body.email || null }).returning() as any[]
  if (!dojo) throw createError({ statusCode: 500, statusMessage: 'Failed to create location' })
  return { success: true, dojo }
})
