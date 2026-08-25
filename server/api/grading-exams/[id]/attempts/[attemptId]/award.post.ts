import { db, tables } from '../../../../../utils/database'
import { and, eq } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../../utils/permissions'
import { writeAuditLog } from '../../../../../utils/audit'

export default defineEventHandler(async event => {
  const session = await getUserSession(event); const examId = Number(getRouterParam(event, 'id')); const attemptId = Number(getRouterParam(event, 'attemptId'))
  if (!session?.user?.organizationId || !examId || !attemptId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const attempt = await db.query.gradingExamAttempts.findFirst({ where: and(eq(tables.gradingExamAttempts.id, attemptId), eq(tables.gradingExamAttempts.examId, examId)), with: { exam: true, student: { with: { currentBeltRank: true } }, targetBeltRank: { with: { system: true } } } }) as any
  if (!attempt || attempt.exam.organizationId !== session.user.organizationId) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  if (!await isDojoAccessible(session.user.id, session.user.organizationId, attempt.exam.dojoId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  if (attempt.gradingId) return { success: true, gradingId: attempt.gradingId }
  if (attempt.attendanceStatus !== 'appeared') throw createError({ statusCode: 400, statusMessage: 'Only candidates marked as appeared can be awarded a promotion' })
  if (attempt.result !== 'passed' || !['paid', 'waived'].includes(attempt.paymentStatus)) throw createError({ statusCode: 400, statusMessage: 'Only passed candidates with a settled or waived grading fee can be awarded' })
  if (!attempt.targetBeltRank || attempt.targetBeltRank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Set a valid target rank before awarding promotion' })
  if (attempt.student.currentBeltRank && (attempt.targetBeltRank.systemId !== attempt.student.currentBeltRank.systemId || attempt.targetBeltRank.order <= attempt.student.currentBeltRank.order)) {
    throw createError({ statusCode: 400, statusMessage: 'The target rank is no longer above the student’s current belt' })
  }
  const grading = await db.transaction(async (tx) => {
    const [created] = await tx.insert(tables.studentGradings).values({ studentId: attempt.studentId, beltRankId: attempt.targetBeltRankId!, awardedDate: attempt.exam.scheduledAt, examiner: attempt.exam.name, notes: `Awarded from grading exam: ${attempt.exam.name}` }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Could not create the awarded grading' })
    await tx.update(tables.gradingExamAttempts).set({ gradingId: created.id }).where(eq(tables.gradingExamAttempts.id, attempt.id))
    await tx.update(tables.students).set({ currentBeltRankId: attempt.targetBeltRankId, updatedAt: new Date() }).where(eq(tables.students.id, attempt.studentId))
    return created
  })
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'grading.awarded_from_exam', entityType: 'student_grading', entityId: grading.id, targetLabel: `${attempt.student.firstName} ${attempt.student.lastName} — ${attempt.targetBeltRank.name}`, scope: { type: 'dojo', id: attempt.exam.dojoId } })
  return { success: true, gradingId: grading.id }
})
