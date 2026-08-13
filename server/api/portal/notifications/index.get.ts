import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { reconcileStudentFeeNotifications } from '../../../utils/student-notifications'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const user = session?.user
  const studentId = Number((user as unknown as Record<string, unknown> | undefined)?.studentId)
  const organizationId = user?.organizationId
  if (!studentId || !organizationId || user?.role !== 'student') {
    throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  }

  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)),
    columns: { id: true, dojoId: true },
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })

  const now = new Date()
  await reconcileStudentFeeNotifications(studentId, organizationId, now)

  const audience = student.dojoId
    ? or(isNull(tables.announcements.dojoId), eq(tables.announcements.dojoId, student.dojoId))
    : isNull(tables.announcements.dojoId)
  const [feeNotices, announcements] = await Promise.all([
    db.query.studentNotifications.findMany({
      where: and(
        eq(tables.studentNotifications.organizationId, organizationId),
        eq(tables.studentNotifications.studentId, studentId),
        isNull(tables.studentNotifications.resolvedAt),
      ),
      orderBy: [asc(tables.studentNotifications.billingPeriod)],
    }),
    db.query.announcements.findMany({
      where: and(
        eq(tables.announcements.organizationId, organizationId),
        audience,
        lte(tables.announcements.publishedAt, now),
        or(isNull(tables.announcements.expiresAt), gt(tables.announcements.expiresAt, now)),
      ),
      orderBy: [desc(tables.announcements.publishedAt)],
    }),
  ])

  const announcementIds = announcements.map(item => item.id)
  const reads = announcementIds.length
    ? await db.query.announcementReads.findMany({
        where: and(eq(tables.announcementReads.studentId, studentId), inArray(tables.announcementReads.announcementId, announcementIds)),
      })
    : []
  const readIds = new Set(reads.map(item => item.announcementId))

  const items = [
    ...feeNotices.map(item => ({
      id: `fee:${item.id}`,
      kind: 'fee' as const,
      title: item.title,
      message: item.message,
      severity: 'warning' as const,
      actionUrl: item.actionUrl,
      read: item.readAt !== null,
      createdAt: item.lastRemindedAt,
      billingPeriod: item.billingPeriod,
      outstandingAmount: item.outstandingAmount,
    })),
    ...announcements.map(item => ({
      id: `announcement:${item.id}`,
      kind: 'announcement' as const,
      title: item.title,
      message: item.message,
      severity: item.severity,
      actionUrl: null,
      read: readIds.has(item.id),
      createdAt: item.publishedAt,
      billingPeriod: null,
      outstandingAmount: null,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    items,
    unreadCount: items.filter(item => !item.read).length,
    overdue: items.filter(item => item.kind === 'fee'),
    urgentAnnouncements: items.filter(item => item.kind === 'announcement' && item.severity === 'urgent'),
  }
})
