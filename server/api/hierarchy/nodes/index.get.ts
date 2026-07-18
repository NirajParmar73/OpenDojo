import { db, tables } from '../../../../server/utils/database'
import { eq, and, isNull } from 'drizzle-orm'
import { formatHierarchyNodeLabel } from '../../../utils/hierarchy-label'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!session.user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const orgId = session.user.organizationId

  // Fetch all nodes for this organization
  const allNodes = await db.query.hierarchyNodes.findMany({
    where: eq(tables.hierarchyNodes.organizationId, orgId),
    orderBy: (nodes, { asc }) => [asc(nodes.createdAt)],
  })
  const levels = await db.query.hierarchyLevels.findMany({ where: eq(tables.hierarchyLevels.organizationId, orgId) })
  const levelNames = new Map(levels.map(level => [level.id, level.name]))

  // Build a tree structure
  const nodeMap = new Map()
  const roots: any[] = []

  allNodes.forEach(node => {
    nodeMap.set(node.id, { ...node, label: formatHierarchyNodeLabel(node.name, levelNames.get(node.levelId)), children: [] })
  })

  allNodes.forEach(node => {
    const nodeWithChildren = nodeMap.get(node.id)
    if (node.parentId === null) {
      roots.push(nodeWithChildren)
    } else {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(nodeWithChildren)
      } else {
        // If parent not found (shouldn't happen), treat as root
        roots.push(nodeWithChildren)
      }
    }
  })

  // Also fetch level names for display? Not needed now.
  return roots
})
