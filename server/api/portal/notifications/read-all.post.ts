import { and, eq, gt, isNull, lte, or } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session?.user
  const studentId = Number((user as unknown as Record<string, unknown> | undefined)?.studentId)
  const organizationId = user?.organizationId
  if (!studentId || !organizationId || user?.role !== 'student') {
    throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  }
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })

  const now = new Date()
  await db.update(tables.studentNotifications).set({ readAt: now, updatedAt: now }).where(and(
    eq(tables.studentNotifications.organizationId, organizationId),
    eq(tables.studentNotifications.studentId, studentId),
    isNull(tables.studentNotifications.resolvedAt),
  ))

  const audience = student.dojoId
    ? or(isNull(tables.announcements.dojoId), eq(tables.announcements.dojoId, student.dojoId))
    : isNull(tables.announcements.dojoId)
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
