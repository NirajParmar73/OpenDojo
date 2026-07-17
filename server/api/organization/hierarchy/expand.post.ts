import { eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { getSubscription } from '../../../utils/subscription'
import { writeAuditLog } from '../../../utils/audit'

const namesByPlan = {
  'state-pro': ['State / Province', 'District', 'City / Town', 'Branch', 'Dojo'],
  national: ['Country', 'State / Province', 'District', 'City / Town', 'Branch', 'Dojo'],
} as const

export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can expand the workspace structure.' })
  const organizationId = session.user.organizationId
  const { plan } = await getSubscription(organizationId)
  if (plan !== 'state-pro' && plan !== 'national') throw createError({ statusCode: 400, statusMessage: 'Upgrade to State Pro or National before expanding your hierarchy.' })

  const result = await db.transaction(async tx => {
    const dojos = await tx.query.dojos.findMany({ where: eq(tables.dojos.organizationId, organizationId) })
    if (!dojos.length) throw createError({ statusCode: 400, statusMessage: 'Add at least one dojo before expanding the hierarchy.' })
    if (dojos.some(dojo => !dojo.city || !dojo.stateProvince || (plan === 'national' && !dojo.country))) throw createError({ statusCode: 400, statusMessage: 'Every dojo needs city, state/province, and country details before expanding the hierarchy.' })

    const hierarchyNames = namesByPlan[plan]
    const existingLevels = await tx.query.hierarchyLevels.findMany({ where: eq(tables.hierarchyLevels.organizationId, organizationId) })
    const byName = new Map(existingLevels.map(level => [level.name, level]))
    for (const [index, name] of hierarchyNames.entries()) {
      if (!byName.has(name)) {
        const [level] = await tx.insert(tables.hierarchyLevels).values({ organizationId, name, order: index + 1 }).returning()
        byName.set(name, level!)
      }
    }
    for (const [index, name] of hierarchyNames.entries()) await tx.update(tables.hierarchyLevels).set({ order: index + 1, updatedAt: new Date() }).where(eq(tables.hierarchyLevels.id, byName.get(name)!.id))

    const nodes = await tx.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) })
    const findOrCreate = async (levelName: string, name: string, parentId: number | null) => {
      const existing = nodes.find(node => node.levelId === byName.get(levelName)!.id && node.parentId === parentId && node.name.trim().toLowerCase() === name.trim().toLowerCase())
      if (existing) return existing
      const [node] = await tx.insert(tables.hierarchyNodes).values({ organizationId, levelId: byName.get(levelName)!.id, parentId, name }).returning()
      nodes.push(node!)
      return node!
    }

    let migrated = 0
    for (const dojo of dojos) {
      const currentNode = nodes.find(node => node.id === dojo.nodeId)
      const currentLevel = currentNode ? [...byName.entries()].find(([, level]) => level.id === currentNode.levelId)?.[0] : null
      if (plan === 'state-pro' && currentLevel === 'Dojo' && currentNode?.parentId) continue
      let parentId: number | null = null
      if (plan === 'national') parentId = (await findOrCreate('Country', dojo.country!, null)).id
      parentId = (await findOrCreate('State / Province', dojo.stateProvince!, parentId)).id
      parentId = (await findOrCreate('City / Town', dojo.city!, parentId)).id
      parentId = (await findOrCreate('Branch', `${dojo.name} Branch`, parentId)).id
      const dojoNode = await findOrCreate('Dojo', dojo.name, parentId)
      await tx.update(tables.dojos).set({ nodeId: dojoNode.id, updatedAt: new Date() }).where(eq(tables.dojos.id, dojo.id))
      migrated++
    }
    return { migrated, levels: hierarchyNames }
  })

  await writeAuditLog({ organizationId, actorUserId: session.user.id, action: 'hierarchy.expanded_for_plan', entityType: 'organization', entityId: organizationId, targetLabel: plan, scope: { type: 'organization' }, details: `Expanded hierarchy for ${result.migrated} dojo(s): ${result.levels.join(' → ')}` })
  return { success: true, ...result }
})
