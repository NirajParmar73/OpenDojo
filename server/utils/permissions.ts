import { db, tables } from '../../server/utils/database'
import { eq, inArray } from 'drizzle-orm'

export async function getAccessibleDojoIds(userId: number, organizationId: number): Promise<number[] | null> {
  // 1. Get the user's primary role from the users table
  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
  })
  if (!user) return []

  // 2. If the user has an organization-wide role (owner/admin), return null (unrestricted)
  if (user.role === 'owner' || user.role === 'admin') {
    return null
  }

  // 3. Otherwise, fetch assignments to determine scoped access
  const assignments = await db.query.assignments.findMany({
    where: eq(tables.assignments.userId, userId),
  })

  // No assignments → no access to any dojo
  if (assignments.length === 0) {
    return []
  }

  // 4. Collect node IDs and dojo IDs from assignments
  const nodeIds: number[] = []
  const dojoIds: number[] = []

  for (const a of assignments) {
    if (a.scopeType === 'node') {
      nodeIds.push(a.scopeId)
    } else if (a.scopeType === 'dojo') {
      dojoIds.push(a.scopeId)
    }
  }

  // If only dojo assignments exist, return those directly
  if (nodeIds.length === 0) {
    return dojoIds.length > 0 ? dojoIds : []
  }

  // 5. Build the node hierarchy to get all descendant nodes
  const allNodes = await db.query.hierarchyNodes.findMany({
    where: eq(tables.hierarchyNodes.organizationId, organizationId),
  })

  const nodeMap: Record<number, any> = {}
  for (const n of allNodes) {
    nodeMap[n.id] = n
  }

  function getDescendantNodeIds(nodeId: number): number[] {
    const result: number[] = [nodeId]
    for (const n of allNodes) {
      if (n.parentId === nodeId) {
        result.push(...getDescendantNodeIds(n.id))
      }
    }
    return result
  }

  const allAllowedNodeIds: number[] = []
  for (const nid of nodeIds) {
    allAllowedNodeIds.push(...getDescendantNodeIds(nid))
  }
  const uniqueNodeIds = [...new Set(allAllowedNodeIds)]

  // 6. Get all dojos under these nodes
  const dojosUnderNodes = await db.query.dojos.findMany({
    where: inArray(tables.dojos.nodeId, uniqueNodeIds),
  })
  const dojoIdsFromNodes = dojosUnderNodes.map(d => d.id)

  // 7. Combine and deduplicate
  const allDojoIds = [...new Set([...dojoIdsFromNodes, ...dojoIds])]

  return allDojoIds.length > 0 ? allDojoIds : []
}

export async function isDojoAccessible(userId: number, organizationId: number, dojoId: number): Promise<boolean> {
  const accessibleDojoIds = await getAccessibleDojoIds(userId, organizationId)
  if (accessibleDojoIds === null) {
    return true // unrestricted (owner/admin)
  }
  return accessibleDojoIds.includes(dojoId)
}