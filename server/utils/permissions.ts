import { db, tables } from '../utils/database'
import { eq, inArray } from 'drizzle-orm'

// ─── Dojo Access ──────────────────────────────────────────────
export async function getAccessibleDojoIds(userId: number, organizationId: number): Promise<number[] | null> {
  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
  })
  if (!user) return []

  if (user.role === 'owner' || user.role === 'admin') {
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

  if (user.role === 'owner' || user.role === 'admin') {
    const allNodes = await db.query.hierarchyNodes.findMany({
      where: eq(tables.hierarchyNodes.organizationId, organizationId),
    })
    const allDojos = await db.query.dojos.findMany({
      where: eq(tables.dojos.organizationId, organizationId),
    })
    return {
      allowedRoles: ['admin', 'state_head', 'district_head', 'city_head', 'dojo_head', 'instructor', 'member'],
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

  const roleHierarchy = ['owner', 'admin', 'state_head', 'district_head', 'city_head', 'dojo_head', 'instructor', 'member']
  let highestRole = 'member'
  for (const a of assignments) {
    const idx = roleHierarchy.indexOf(a.role)
    if (idx < roleHierarchy.indexOf(highestRole)) {
      highestRole = a.role
    }
  }
  const highestIndex = roleHierarchy.indexOf(highestRole)
  const allowedRoles = roleHierarchy.slice(highestIndex + 1)

  const nodeIds: number[] = []
  const dojoIds: number[] = []
  for (const a of assignments) {
    if (a.scopeType === 'node') nodeIds.push(a.scopeId)
    else if (a.scopeType === 'dojo') dojoIds.push(a.scopeId)
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

  let expandedNodeIds: number[] = []
  for (const nid of nodeIds) {
    expandedNodeIds = expandedNodeIds.concat(await getDescendantNodeIds(nid))
  }
  expandedNodeIds = [...new Set(expandedNodeIds)]

  let allowedDojoIds = dojoIds
  if (expandedNodeIds.length > 0) {
    const dojosUnderNodes = await db.query.dojos.findMany({
      where: inArray(tables.dojos.nodeId, expandedNodeIds),
    })
    allowedDojoIds = allowedDojoIds.concat(dojosUnderNodes.map(d => d.id))
  }
  allowedDojoIds = [...new Set(allowedDojoIds)]

  return {
    allowedRoles,
    allowedNodeIds: expandedNodeIds,
    allowedDojoIds,
  }
}