import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session?.user
  const studentId = Number((user as unknown as Record<string, unknown> | undefined)?.studentId)
  const organizationId = user?.organizationId
  if (!studentId || !organizationId || user?.role !== 'student') {
    throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  }

  const rawId = decodeURIComponent(getRouterParam(event, 'id') || '')
  const [kind = '', value = ''] = rawId.split(':')
  const id = Number(value)
  if (!id || !['fee', 'announcement'].includes(kind)) throw createError({ statusCode: 400, statusMessage: 'Invalid notification' })

  if (kind === 'fee') {
    await db.update(tables.studentNotifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(
      eq(tables.studentNotifications.id, id),
      eq(tables.studentNotifications.studentId, studentId),
      eq(tables.studentNotifications.organizationId, organizationId),
    ))
  } else {
    const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)) })
    const announcement = await db.query.announcements.findFirst({ where: and(eq(tables.announcements.id, id), eq(tables.announcements.organizationId, organizationId)) })
    if (!student || !announcement || (announcement.dojoId !== null && announcement.dojoId !== student.dojoId)) {
      throw createError({ statusCode: 404, statusMessage: 'Notification not found' })
    }
    await db.insert(tables.announcementReads).values({ announcementId: id, studentId }).onConflictDoUpdate({
      target: [tables.announcementReads.announcementId, tables.announcementReads.studentId],
      set: { readAt: new Date() },
    })
  }

  return { success: true }
})
