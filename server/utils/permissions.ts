import { db, tables } from '../utils/database'
import { eq, inArray } from 'drizzle-orm'

export const roleHierarchy = ['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor', 'member']

export async function getHierarchyManagementScope(userId: number, organizationId: number) {
  const user = await db.query.users.findFirst({ where: eq(tables.users.id, userId) })
  const allNodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) })
  const allDojos = await db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, organizationId) })

  if (user?.role === 'owner') {
    return {
      managedParentNodeIds: allNodes.map(node => node.id),
      managedNodeIds: allNodes.map(node => node.id),
      managedDojoIds: allDojos.map(dojo => dojo.id),
    }
  }

  const assignments = await db.query.assignments.findMany({ where: eq(tables.assignments.userId, userId) })
  const assignedNodeIds = assignments.filter(item => item.scopeType === 'node').map(item => item.scopeId)
  const directlyAssignedDojoIds = assignments.filter(item => item.scopeType === 'dojo').map(item => item.scopeId)
  const childrenByParent = new Map<number, number[]>()
  for (const node of allNodes) {
    if (node.parentId !== null) childrenByParent.set(node.parentId, [...(childrenByParent.get(node.parentId) || []), node.id])
  }
  const descendantNodeIds = new Set<number>()
  const visit = (nodeId: number) => {
    for (const childId of childrenByParent.get(nodeId) || []) {
      if (!descendantNodeIds.has(childId)) {
        descendantNodeIds.add(childId)
        visit(childId)
      }
    }
  }
  for (const nodeId of assignedNodeIds) visit(nodeId)

  const managedParentNodeIds = [...new Set([...assignedNodeIds, ...descendantNodeIds])]
  return {
    // The assigned node itself is a boundary: a head can add below it, but cannot rename or delete it.
    managedParentNodeIds,
    managedNodeIds: [...descendantNodeIds],
    managedDojoIds: [...new Set([
      ...directlyAssignedDojoIds,
      ...allDojos.filter(dojo => managedParentNodeIds.includes(dojo.nodeId)).map(dojo => dojo.id),
    ])],
  }
}

// ─── Dojo Access ──────────────────────────────────────────────
export async function getAccessibleDojoIds(userId: number, organizationId: number): Promise<number[] | null> {
  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
  })
  if (!user) return []

  if (user.role === 'owner') {
    return null
  }

  const assignments = await db.query.assignments.findMany({
    where: eq(tables.assignments.userId, userId),
  })

  if (assignments.length === 0) return []

  const nodeIds: number[] = []
  const dojoIds: number[] = []

  for (const a of assignments) {
    if (a.scopeType === 'node') nodeIds.push(a.scopeId)
    else if (a.scopeType === 'dojo') dojoIds.push(a.scopeId)
  }

  if (nodeIds.length === 0) {
    return dojoIds.length > 0 ? dojoIds : []
  }

  const allNodes = await db.query.hierarchyNodes.findMany({
    where: eq(tables.hierarchyNodes.organizationId, organizationId),
  })

  async function getDescendantNodeIds(nodeId: number): Promise<number[]> {
    const result: number[] = [nodeId]
    for (const n of allNodes) {
      if (n.parentId === nodeId) {
        result.push(...await getDescendantNodeIds(n.id))
      }
    }
    return result
  }

  const allAllowedNodeIds: number[] = []
  for (const nid of nodeIds) {
    allAllowedNodeIds.push(...await getDescendantNodeIds(nid))
  }
  const uniqueNodeIds = [...new Set(allAllowedNodeIds)]

  const dojosUnderNodes = await db.query.dojos.findMany({
    where: inArray(tables.dojos.nodeId, uniqueNodeIds),
  })
  const dojoIdsFromNodes = dojosUnderNodes.map(d => d.id)

  const allDojoIds = [...new Set([...dojoIdsFromNodes, ...dojoIds])]
  return allDojoIds.length > 0 ? allDojoIds : []
}

export async function isDojoAccessible(userId: number, organizationId: number, dojoId: number): Promise<boolean> {
  const accessibleDojoIds = await getAccessibleDojoIds(userId, organizationId)
  if (accessibleDojoIds === null) return true
  return accessibleDojoIds.includes(dojoId)
}

// ─── User Creation Permissions ──────────────────────────────
export async function getAllowedAssignmentsForCreator(userId: number, organizationId: number) {
  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
  })
  if (!user) return { allowedRoles: [], allowedNodeIds: [], allowedDojoIds: [] }

  if (user.role === 'owner') {
    const allNodes = await db.query.hierarchyNodes.findMany({
      where: eq(tables.hierarchyNodes.organizationId, organizationId),
    })
    const allDojos = await db.query.dojos.findMany({
      where: eq(tables.dojos.organizationId, organizationId),
    })
    return {
      allowedRoles: ['admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor', 'member'],
      allowedNodeIds: allNodes.map(n => n.id),
      allowedDojoIds: allDojos.map(d => d.id),
    }
  }

  const assignments = await db.query.assignments.findMany({
    where: eq(tables.assignments.userId, userId),
  })
  if (assignments.length === 0) {
    return { allowedRoles: [], allowedNodeIds: [], allowedDojoIds: [] }
  }

  let highestRole = 'member'
  for (const a of assignments) {
    const idx = roleHierarchy.indexOf(a.role)
    if (idx < roleHierarchy.indexOf(highestRole)) {
      highestRole = a.role
    }
  }
  const highestIndex = roleHierarchy.indexOf(highestRole)
  const allowedRoles = roleHierarchy.slice(highestIndex + 1)

  const scope = await getHierarchyManagementScope(userId, organizationId)

  return {
    allowedRoles,
    allowedNodeIds: scope.managedNodeIds,
    allowedDojoIds: scope.managedDojoIds,
  }
}

export async function assertDojoManagementAccess(userId: number, organizationId: number, dojoId: number) {
  if (!await isDojoAccessible(userId, organizationId, dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'This dojo is outside your assigned territory' })
  }
}

export async function assertNodeManagementAccess(userId: number, organizationId: number, nodeId: number) {
  const scope = await getHierarchyManagementScope(userId, organizationId)
  if (!scope.managedParentNodeIds.includes(nodeId)) {
    throw createError({ statusCode: 403, statusMessage: 'This hierarchy node is outside your assigned territory' })
  }
}

export async function assertHierarchyNodeModificationAccess(userId: number, organizationId: number, nodeId: number) {
  const scope = await getHierarchyManagementScope(userId, organizationId)
  if (!scope.managedNodeIds.includes(nodeId)) {
    throw createError({ statusCode: 403, statusMessage: 'You can only modify hierarchy nodes below your assigned level' })
  }
}
