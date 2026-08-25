import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, tables } from './database'
import { financeManagerRoles, isDojoWithinHierarchyNode } from './permissions'

export type SyllabusScope = { scopeType: 'organization' | 'node' | 'dojo', scopeId: number | null, label?: string }

export async function getManageableSyllabusScopes(userId: number, organizationId: number): Promise<SyllabusScope[]> {
  const user = await db.query.users.findFirst({ where: and(eq(tables.users.id, userId), eq(tables.users.organizationId, organizationId)) })
  if (!user) return []
  if (['owner', 'admin'].includes(user.role)) return [{ scopeType: 'organization', scopeId: null, label: 'Entire organization' }]

  const assignments = await db.query.assignments.findMany({ where: eq(tables.assignments.userId, userId) })
  const management = assignments.filter(item => financeManagerRoles.includes(item.role))
  const nodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) })
  const dojos = await db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, organizationId) })
  return management.map((assignment) => {
    const label = assignment.scopeType === 'node'
      ? nodes.find(node => node.id === assignment.scopeId)?.name || 'Assigned territory'
      : dojos.find(dojo => dojo.id === assignment.scopeId)?.name || 'Assigned dojo'
    return { scopeType: assignment.scopeType, scopeId: assignment.scopeId, label } as SyllabusScope
  }).filter((scope, index, all) => all.findIndex(item => item.scopeType === scope.scopeType && item.scopeId === scope.scopeId) === index)
}

export async function assertSyllabusScopeAccess(userId: number, organizationId: number, scopeType: SyllabusScope['scopeType'], scopeId: number | null) {
  const scopes = await getManageableSyllabusScopes(userId, organizationId)
  if (!scopes.some(scope => scope.scopeType === scopeType && scope.scopeId === scopeId)) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot manage the syllabus for this scope' })
  }
}

export async function canAssessStudentSyllabus(userId: number, organizationId: number, dojoId: number | null) {
  const user = await db.query.users.findFirst({ where: and(eq(tables.users.id, userId), eq(tables.users.organizationId, organizationId)) })
  if (!user) return false
  if (['owner', 'admin'].includes(user.role)) return true
  if (!dojoId) return false
  const assignments = await db.query.assignments.findMany({ where: eq(tables.assignments.userId, userId) })
  for (const assignment of assignments.filter(item => financeManagerRoles.includes(item.role))) {
    if (assignment.scopeType === 'dojo' && assignment.scopeId === dojoId) return true
    if (assignment.scopeType === 'node' && await isDojoWithinHierarchyNode(organizationId, dojoId, assignment.scopeId)) return true
  }
  return false
}

export async function getNextBeltRank(studentId: number, organizationId: number) {
  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)),
    with: { currentBeltRank: true },
  })
  if (!student) return { student: null, nextRank: null }
  const systems = await db.query.beltSystems.findMany({ where: eq(tables.beltSystems.organizationId, organizationId), with: { ranks: true } })
  const system = student.currentBeltRank
    ? systems.find(item => item.id === student.currentBeltRank?.systemId)
    : systems.find(item => item.programId === student.programId) || systems[0]
  const ranks = system?.ranks.slice().sort((left, right) => left.order - right.order) || []
  const currentIndex = ranks.findIndex(rank => rank.id === student.currentBeltRankId)
  return { student, nextRank: currentIndex >= 0 ? ranks[currentIndex + 1] || null : ranks[0] || null }
}

async function syllabusScopeScore(syllabus: typeof tables.syllabi.$inferSelect, organizationId: number, dojoId: number | null) {
  if (syllabus.scopeType === 'organization') return 1
  if (!dojoId || !syllabus.scopeId) return -1
  if (syllabus.scopeType === 'dojo') return syllabus.scopeId === dojoId ? 1000 : -1
  if (!await isDojoWithinHierarchyNode(organizationId, dojoId, syllabus.scopeId)) return -1
  const nodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId) })
  const dojo = await db.query.dojos.findFirst({ where: eq(tables.dojos.id, dojoId) })
  const byId = new Map(nodes.map(node => [node.id, node]))
  let nodeId: number | null = dojo?.nodeId || null
  let distance = 0
  while (nodeId !== null) {
    if (nodeId === syllabus.scopeId) return 500 - distance
    nodeId = byId.get(nodeId)?.parentId ?? null
    distance++
  }
  return -1
}

export async function resolvePublishedSyllabusVersion(organizationId: number, targetBeltRankId: number, dojoId: number | null) {
  const candidates = await db.query.syllabi.findMany({
    where: and(eq(tables.syllabi.organizationId, organizationId), eq(tables.syllabi.targetBeltRankId, targetBeltRankId)),
  })
  const scored = await Promise.all(candidates.map(async syllabus => ({ syllabus, score: await syllabusScopeScore(syllabus, organizationId, dojoId) })))
  for (const candidate of scored.filter(item => item.score >= 0).sort((a, b) => b.score - a.score)) {
    const version = await db.query.syllabusVersions.findFirst({
      where: and(eq(tables.syllabusVersions.syllabusId, candidate.syllabus.id), eq(tables.syllabusVersions.status, 'published')),
      orderBy: [desc(tables.syllabusVersions.version)],
    })
    if (version) return version
  }
  return null
}

export async function getVersionSections(versionId: number) {
  const versions: Array<typeof tables.syllabusVersions.$inferSelect> = []
  const seen = new Set<number>()
  let currentId: number | null = versionId
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    const version: typeof tables.syllabusVersions.$inferSelect | undefined = await db.query.syllabusVersions.findFirst({ where: eq(tables.syllabusVersions.id, currentId) })
    if (!version) break
    versions.unshift(version)
    currentId = version.parentVersionId
  }
  if (!versions.length) return []
  const sections = await db.query.syllabusSections.findMany({
    where: inArray(tables.syllabusSections.versionId, versions.map(version => version.id)),
    with: { items: true },
  })
  const versionOrder = new Map(versions.map((version, index) => [version.id, index]))
  return sections
    .sort((left, right) => (versionOrder.get(left.versionId)! - versionOrder.get(right.versionId)!) || left.order - right.order)
    .map(section => ({ ...section, items: section.items.slice().sort((left, right) => left.order - right.order) }))
}

export async function getStudentSyllabusProgress(studentId: number, organizationId: number) {
  const { student, nextRank } = await getNextBeltRank(studentId, organizationId)
  if (!student) return null
  if (!nextRank) return { student, targetRank: null, version: null, assignment: null, sections: [], ready: false, completed: 0, total: 0, reason: 'Highest configured rank reached' }

  let assignment = await db.query.studentSyllabusAssignments.findFirst({
    where: and(eq(tables.studentSyllabusAssignments.studentId, studentId), eq(tables.studentSyllabusAssignments.targetBeltRankId, nextRank.id)),
  })
  const version = assignment
    ? await db.query.syllabusVersions.findFirst({ where: eq(tables.syllabusVersions.id, assignment.versionId) })
    : await resolvePublishedSyllabusVersion(organizationId, nextRank.id, student.dojoId)
  if (!version) return { student, targetRank: nextRank, version: null, assignment: null, sections: [], ready: false, completed: 0, total: 0, reason: 'No published syllabus for the next rank' }

  const sections = await getVersionSections(version.id)
  const items = sections.flatMap(section => section.items)
  const assessments = assignment
    ? await db.query.studentSyllabusAssessments.findMany({ where: eq(tables.studentSyllabusAssessments.assignmentId, assignment.id) })
    : []
  const assessmentByItem = new Map(assessments.map(item => [item.itemId, item]))
  const enrichedSections = sections.map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, assessment: assessmentByItem.get(item.id) || null })),
  }))
  const required = items.filter(item => item.required)
  const completed = required.filter(item => assessmentByItem.get(item.id)?.status === 'ready').length
  const ready = required.length > 0 && completed === required.length
  if (assignment && assignment.status !== (ready ? 'eligible' : 'in_progress')) {
    await db.update(tables.studentSyllabusAssignments).set({ status: ready ? 'eligible' : 'in_progress' }).where(eq(tables.studentSyllabusAssignments.id, assignment.id))
    assignment = { ...assignment, status: ready ? 'eligible' : 'in_progress' }
  }
  return { student, targetRank: nextRank, version, assignment, sections: enrichedSections, ready, completed, total: required.length, reason: required.length ? null : 'The published syllabus has no required items' }
}

export async function ensureStudentSyllabusAssignment(studentId: number, organizationId: number) {
  const progress = await getStudentSyllabusProgress(studentId, organizationId)
  if (!progress?.targetRank || !progress.version) throw createError({ statusCode: 409, statusMessage: progress?.reason || 'No syllabus is available' })
  if (progress.assignment) return { progress, assignment: progress.assignment }
  const [assignment] = await db.insert(tables.studentSyllabusAssignments).values({
    studentId,
    versionId: progress.version.id,
    targetBeltRankId: progress.targetRank.id,
  }).returning()
  if (!assignment) throw createError({ statusCode: 500, statusMessage: 'Could not start syllabus progress' })
  return { progress, assignment }
}
