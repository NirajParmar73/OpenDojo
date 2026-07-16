import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { getAccessibleDojoIds, getHierarchyManagementScope } from '../../utils/permissions'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const dojoIds = session.user.role === 'admin' ? null : await getAccessibleDojoIds(session.user.id, session.user.organizationId)
  const managementScope = await getHierarchyManagementScope(session.user.id, session.user.organizationId)
  const allDojos = await db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, session.user.organizationId), with: { node: true } })
  const dojos = dojoIds === null ? allDojos : allDojos.filter(dojo => dojoIds.includes(dojo.id))
  const allNodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, session.user.organizationId) })
  // Reports may include the caller's assigned node (e.g. Gujarat), but never
  // an ancestor such as India or a sibling territory.
  const selectableNodeIds = dojoIds === null
    ? new Set(allNodes.map(node => node.id))
    : new Set(managementScope.managedParentNodeIds)
  return {
    nodes: allNodes.filter(node => selectableNodeIds.has(node.id)).map(node => ({ id: node.id, name: node.name, parentId: node.parentId })),
    dojos: dojos.map(dojo => ({ id: dojo.id, name: dojo.name, nodeId: dojo.nodeId }))
  }
})
