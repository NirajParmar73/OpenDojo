import { and, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session?.user
  const studentId = Number((user as unknown as Record<string, unknown> | undefined)?.studentId)
  const organizationId = user?.organizationId
  if (!studentId || !organizationId || user?.role !== 'student') {
    throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  }
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)), with: { dojo: { columns: { nodeId: true } } } })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })

  const now = new Date()
  await db.update(tables.studentNotifications).set({ readAt: now, updatedAt: now }).where(and(
    eq(tables.studentNotifications.organizationId, organizationId),
    eq(tables.studentNotifications.studentId, studentId),
    isNull(tables.studentNotifications.resolvedAt),
  ))

  const territoryNodeIds: number[] = []
  if (student.dojo?.nodeId) {
    const nodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId), columns: { id: true, parentId: true } })
    const nodesById = new Map(nodes.map(node => [node.id, node]))
    let nodeId: number | null = student.dojo.nodeId
    while (nodeId !== null) {
      territoryNodeIds.push(nodeId)
      nodeId = nodesById.get(nodeId)?.parentId ?? null
    }
  }
  const audience = or(
    and(isNull(tables.announcements.dojoId), isNull(tables.announcements.scopeNodeId)),
    ...(student.dojoId ? [eq(tables.announcements.dojoId, student.dojoId)] : []),
    ...(territoryNodeIds.length ? [inArray(tables.announcements.scopeNodeId, territoryNodeIds)] : []),
  )
  const announcements = await db.query.announcements.findMany({
    where: and(eq(tables.announcements.organizationId, organizationId), audience, lte(tables.announcements.publishedAt, now), or(isNull(tables.announcements.expiresAt), gt(tables.announcements.expiresAt, now))),
    columns: { id: true },
  })
  if (announcements.length) {
    await db.insert(tables.announcementReads)
      .values(announcements.map(item => ({ announcementId: item.id, studentId, readAt: now })))
      .onConflictDoUpdate({
        target: [tables.announcementReads.announcementId, tables.announcementReads.studentId],
        set: { readAt: now },
      })
  }
  return { success: true }
})
