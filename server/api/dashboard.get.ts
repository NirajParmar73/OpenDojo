import { db, tables } from '../utils/database'
import { eq } from 'drizzle-orm'
import { getAccessibleDojoIds } from '../utils/permissions'
import { formatHierarchyNodeLabel } from '../utils/hierarchy-label'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const organizationId = session.user.organizationId
  if (!organizationId) throw createError({ statusCode: 400, statusMessage: 'User has no organization' })

  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, organizationId)
  const allDojos = await db.query.dojos.findMany({
    where: eq(tables.dojos.organizationId, organizationId),
    with: { node: true }
  })
  const dojos = accessibleDojoIds === null ? allDojos : allDojos.filter(dojo => accessibleDojoIds.includes(dojo.id))
  const dojoIds = new Set(dojos.map(dojo => dojo.id))
  const allNodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) })
  const levels = await db.query.hierarchyLevels.findMany({
    where: eq(tables.hierarchyLevels.organizationId, organizationId),
    orderBy: (levels, { asc }) => [asc(levels.order)]
  })
  const levelNames = new Map(levels.map(level => [level.id, level.name]))
  const nodesById = new Map(allNodes.map(node => [node.id, node]))
  const accessibleNodeIds = new Set<number>()
  for (const dojo of dojos) {
    let nodeId: number | null = dojo.nodeId
    while (nodeId !== null && !accessibleNodeIds.has(nodeId)) {
      accessibleNodeIds.add(nodeId)
      nodeId = nodesById.get(nodeId)?.parentId || null
    }
  }

  const allStudents = await db.query.students.findMany({ where: eq(tables.students.organizationId, organizationId) })
  const students = accessibleDojoIds === null ? allStudents : allStudents.filter(student => student.dojoId !== null && dojoIds.has(student.dojoId))

  const allUsers = await db.query.users.findMany({
    where: eq(tables.users.organizationId, organizationId),
    with: { assignments: true }
  })
  const users = accessibleDojoIds === null
    ? allUsers
    : allUsers.filter(user => user.assignments.some(assignment => (
        assignment.scopeType === 'dojo'
          ? dojoIds.has(assignment.scopeId)
          : accessibleNodeIds.has(assignment.scopeId)
      )))
  const instructors = users.filter(user => user.assignments.some(assignment => assignment.role === 'instructor'))
  const studentCountByDojo = new Map<number, number>()
  for (const student of students) {
    if (student.dojoId) studentCountByDojo.set(student.dojoId, (studentCountByDojo.get(student.dojoId) || 0) + 1)
  }

  const assignments = await db.query.assignments.findMany({
    where: eq(tables.assignments.userId, session.user.id)
  })
  const scopedNodeIds = assignments
    .filter(assignment => assignment.scopeType === 'node')
    .map(assignment => assignment.scopeId)

  // Organization owners see the State/Region level (when configured). A hierarchy
  // head sees the next level below their assigned node, e.g. districts for a state head.
  const isOrganizationWide = accessibleDojoIds === null
  const preferredLevel = levels.find(level => /state|region/i.test(level.name))
  const childLevelIds = new Set(
    allNodes
      .filter(node => scopedNodeIds.includes(node.parentId))
      .map(node => node.levelId)
  )
  const breakdownLevel = isOrganizationWide
    ? preferredLevel
    : levels.find(level => childLevelIds.has(level.id))

  const breakdownByNode = new Map<number, { id: number, name: string, dojos: number, students: number }>()
  const ungrouped = { id: 0, name: isOrganizationWide ? 'Unassigned' : 'Directly assigned', dojos: 0, students: 0 }

  function findBreakdownNode(dojoNodeId: number) {
    let node = nodesById.get(dojoNodeId)
    while (node) {
      if (breakdownLevel && node.levelId === breakdownLevel.id) return node
      node = node.parentId === null ? undefined : nodesById.get(node.parentId)
    }
    return undefined
  }

  for (const dojo of dojos) {
    const node = findBreakdownNode(dojo.nodeId)
    if (!node) {
      ungrouped.dojos += 1
      ungrouped.students += studentCountByDojo.get(dojo.id) || 0
      continue
    }
    const item = breakdownByNode.get(node.id) || { id: node.id, name: formatHierarchyNodeLabel(node.name, levelNames.get(node.levelId)), dojos: 0, students: 0 }
    item.dojos += 1
    item.students += studentCountByDojo.get(dojo.id) || 0
    breakdownByNode.set(node.id, item)
  }

  // A dojo-level assignment has no child node to summarize, so present each dojo
  // as a useful, still permission-scoped breakdown.
  const breakdownItems = breakdownLevel
    ? [...breakdownByNode.values(), ...(ungrouped.dojos ? [ungrouped] : [])]
    : dojos.map(dojo => ({
        id: dojo.id,
        name: dojo.name,
        dojos: 1,
        students: studentCountByDojo.get(dojo.id) || 0
      }))

  return {
    scope: accessibleDojoIds === null ? 'Organization-wide' : 'Your assigned territory',
    totals: { dojos: dojos.length, students: students.length, staff: users.length, instructors: instructors.length },
    hierarchyBreakdown: {
      label: breakdownLevel?.name || 'Dojo',
      items: breakdownItems.sort((a, b) => b.students - a.students || a.name.localeCompare(b.name))
    },
    dojos: dojos.map(dojo => ({
      id: dojo.id,
      name: dojo.name,
      nodeName: dojo.node?.name || 'Unassigned',
      studentCount: studentCountByDojo.get(dojo.id) || 0
    }))
  }
})
