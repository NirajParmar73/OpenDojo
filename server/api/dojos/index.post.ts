import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { and, eq } from 'drizzle-orm'
import { assertNodeManagementAccess } from '../../utils/permissions'
import { assertDojoLimit, assertDojoTerritory, getSubscription } from '../../utils/subscription'
import { getLocationFromHierarchyNode } from '../../utils/hierarchy-location'

const createDojoSchema = z.object({
  nodeId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().trim().max(100).optional(),
  stateProvince: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).optional(),
  subdivisionCode: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(20).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
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

  const body = await readValidatedBody(event, createDojoSchema.parse)
  await assertDojoLimit(orgId)
  const subscription = await getSubscription(orgId)
  const isCityPlan = subscription.plan === 'city-starter' || subscription.plan === 'city-pro'
  const isAdvancedPlan = subscription.plan === 'state-pro' || subscription.plan === 'national'
  const hierarchyLocation = body.nodeId ? await getLocationFromHierarchyNode(orgId, body.nodeId, subscription.plan === 'national') : {}
  const location = {
    city: hierarchyLocation.city || body.city,
    stateProvince: hierarchyLocation.stateProvince || body.stateProvince,
    country: hierarchyLocation.country || body.country,
    countryCode: hierarchyLocation.countryCode || body.countryCode,
    subdivisionCode: hierarchyLocation.subdivisionCode || body.subdivisionCode,
    postalCode: hierarchyLocation.postalCode || body.postalCode,
  }
  await assertDojoTerritory(orgId, location)
  let nodeId = body.nodeId || null

  // City workspaces are organized by their location fields, not a manual
  // country/state hierarchy. Create or reuse one internal dojo node instead.
  if (isCityPlan) {
    const hierarchyLevels = await db.query.hierarchyLevels.findMany({ where: eq(tables.hierarchyLevels.organizationId, orgId) })
    const dojoLevel = hierarchyLevels.find(level => level.name.trim().toLowerCase() === 'dojo')
    if (!dojoLevel) throw createError({ statusCode: 400, statusMessage: 'Workspace hierarchy is not ready. Please contact support.' })
    let cityNode = await db.query.hierarchyNodes.findFirst({ where: eq(tables.hierarchyNodes.levelId, dojoLevel.id), orderBy: (node, { asc }) => [asc(node.id)] })
    if (!cityNode) {
      const [createdNode] = await db.insert(tables.hierarchyNodes).values({ organizationId: orgId, levelId: dojoLevel.id, name: `${location.city || 'City'} locations` }).returning()
      cityNode = createdNode
    }
    nodeId = cityNode?.id || null
  }
  // Older workspaces and workspaces created before their first dojo may not
  // have a hierarchy yet. Build the first valid path from the dojo location.
  if (isAdvancedPlan && !nodeId) {
    if (!location.city || !location.stateProvince || (subscription.plan === 'national' && !location.country)) throw createError({ statusCode: 400, statusMessage: 'Enter the city, state/province, and country before creating the first dojo.' })
    const requiredLevels = subscription.plan === 'national' ? ['Country', 'State / Province', 'City / Town', 'Branch', 'Dojo'] : ['State / Province', 'City / Town', 'Branch', 'Dojo']
    const levels = await db.query.hierarchyLevels.findMany({ where: eq(tables.hierarchyLevels.organizationId, orgId) })
    const levelByName = new Map(levels.map(level => [level.name, level]))
    for (const [index, name] of requiredLevels.entries()) {
      if (!levelByName.has(name)) {
        const [level] = await db.insert(tables.hierarchyLevels).values({ organizationId: orgId, name, order: index + 1 }).returning()
        levelByName.set(name, level!)
      }
    }
    const nodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, orgId) })
    const findOrCreate = async (levelName: string, name: string, parentId: number | null) => {
      const existing = nodes.find(node => node.levelId === levelByName.get(levelName)!.id && node.parentId === parentId && node.name.trim().toLowerCase() === name.trim().toLowerCase())
      if (existing) return existing
      const [created] = await db.insert(tables.hierarchyNodes).values({ organizationId: orgId, levelId: levelByName.get(levelName)!.id, parentId, name }).returning()
      nodes.push(created!)
      return created!
    }
    let parentId: number | null = null
    if (subscription.plan === 'national') parentId = (await findOrCreate('Country', location.country!, null)).id
    parentId = (await findOrCreate('State / Province', location.stateProvince!, parentId)).id
    parentId = (await findOrCreate('City / Town', location.city!, parentId)).id
    parentId = (await findOrCreate('Branch', `${body.name} Branch`, parentId)).id
    nodeId = (await findOrCreate('Dojo', body.name, parentId)).id
  }
  if (!nodeId) throw createError({ statusCode: 400, statusMessage: 'Select a hierarchy node before creating this dojo.' })

  // Verify node belongs to the organization
  const node = await db.query.hierarchyNodes.findFirst({
    where: eq(tables.hierarchyNodes.id, nodeId),
  })
  if (!node || node.organizationId !== orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid node ID' })
  }
  if (!isCityPlan && body.nodeId) {
    const nodeLevel = await db.query.hierarchyLevels.findFirst({ where: eq(tables.hierarchyLevels.id, node.levelId) })
    if (!nodeLevel || !['City / Town', 'Branch'].includes(nodeLevel.name)) throw createError({ statusCode: 400, statusMessage: 'Choose a City/Town or Branch location for this dojo.' })

    // A hierarchy-only "Dojo" node from an earlier setup is not an
    // operational dojo. Reuse it when it matches, otherwise create the
    // operational node here as part of creating the dojo record.
    const dojoLevel = await db.query.hierarchyLevels.findFirst({
      where: and(eq(tables.hierarchyLevels.organizationId, orgId), eq(tables.hierarchyLevels.name, 'Dojo')),
    })
    if (dojoLevel && dojoLevel.order > nodeLevel.order) {
      const childNodes = await db.query.hierarchyNodes.findMany({
        where: and(eq(tables.hierarchyNodes.organizationId, orgId), eq(tables.hierarchyNodes.parentId, nodeId), eq(tables.hierarchyNodes.levelId, dojoLevel.id)),
      })
      const matchingNode = childNodes.find(child => child.name.trim().toLowerCase() === body.name.trim().toLowerCase())
      if (matchingNode) {
        nodeId = matchingNode.id
      } else {
        const [createdNode] = await db.insert(tables.hierarchyNodes).values({ organizationId: orgId, levelId: dojoLevel.id, parentId: nodeId, name: body.name }).returning()
        nodeId = createdNode?.id || nodeId
      }
    }
  }
  await assertNodeManagementAccess(session.user.id, orgId, nodeId)

  const [dojo] = await db.insert(tables.dojos).values({
    organizationId: orgId,
    nodeId,
    name: body.name,
    address: body.address || null,
    city: location.city || null,
    stateProvince: location.stateProvince || null,
    country: location.country || null,
    countryCode: location.countryCode || null,
    subdivisionCode: location.subdivisionCode || null,
    postalCode: location.postalCode || null,
    phone: body.phone || null,
    email: body.email || null,
  }).returning() as any[]

  if (!dojo) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create dojo' })
  }

  return { success: true, dojo }
})
