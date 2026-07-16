import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number((session?.user as unknown as Record<string, unknown>)?.studentId)
  if (!studentId || session?.user?.role !== 'student' || !session.user.organizationId) throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)), with: { dojo: true, currentBeltRank: true } })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const [gradings, achievements, payments, documents, attendance] = await Promise.all([
    db.query.studentGradings.findMany({ where: eq(tables.studentGradings.studentId, studentId), with: { beltRank: true }, orderBy: (grading, { desc }) => [desc(grading.awardedDate)] }),
    db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.studentId, studentId), orderBy: (achievement, { desc }) => [desc(achievement.startDate)] }),
    db.query.payments.findMany({ where: eq(tables.payments.studentId, studentId), orderBy: (payment, { desc }) => [desc(payment.paymentDate)] }),
    db.query.documents.findMany({ where: eq(tables.documents.studentId, studentId), orderBy: (document, { desc }) => [desc(document.createdAt)] }),
    db.query.attendance.findMany({ where: eq(tables.attendance.studentId, studentId), with: { session: { with: { dojo: true, instructor: true } } } })
  ])
  const attendanceRecords = attendance.sort((a, b) => new Date(b.session?.date || 0).getTime() - new Date(a.session?.date || 0).getTime())
  const present = attendanceRecords.filter(record => record.status === 'present' || record.status === 'late').length
  return {
    student,
    gradings,
    achievements,
    payments,
    documents,
    attendance: attendanceRecords,
    attendanceSummary: {
      total: attendanceRecords.length,
      present,
      late: attendanceRecords.filter(record => record.status === 'late').length,
      absent: attendanceRecords.filter(record => record.status === 'absent').length,
      excused: attendanceRecords.filter(record => record.status === 'excused').length,
      rate: attendanceRecords.length ? Math.round((present / attendanceRecords.length) * 100) : 0
    }
  }
})
