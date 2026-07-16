import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number((session?.user as unknown as Record<string, unknown>)?.studentId)
  if (!studentId || session?.user?.role !== 'student' || !session.user.organizationId) throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)), with: { dojo: true, currentBeltRank: true } })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const [gradings, achievements, payments, documents] = await Promise.all([
    db.query.studentGradings.findMany({ where: eq(tables.studentGradings.studentId, studentId), with: { beltRank: true }, orderBy: (grading, { desc }) => [desc(grading.awardedDate)] }),
    db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.studentId, studentId), orderBy: (achievement, { desc }) => [desc(achievement.startDate)] }),
    db.query.payments.findMany({ where: eq(tables.payments.studentId, studentId), orderBy: (payment, { desc }) => [desc(payment.paymentDate)] }),
    db.query.documents.findMany({ where: eq(tables.documents.studentId, studentId), orderBy: (document, { desc }) => [desc(document.createdAt)] })
  ])
  return { student, gradings, achievements, payments, documents }
})
