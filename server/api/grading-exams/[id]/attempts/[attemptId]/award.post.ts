import { db, tables } from '../../../../../utils/database'
import { and, eq } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../../utils/permissions'
import { syncCurrentBeltRank } from '../../../../../utils/gradings'
import { writeAuditLog } from '../../../../../utils/audit'

export default defineEventHandler(async event => {
  const session = await getUserSession(event); const examId = Number(getRouterParam(event, 'id')); const attemptId = Number(getRouterParam(event, 'attemptId'))
  if (!session?.user?.organizationId || !examId || !attemptId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const attempt = await db.query.gradingExamAttempts.findFirst({ where: and(eq(tables.gradingExamAttempts.id, attemptId), eq(tables.gradingExamAttempts.examId, examId)), with: { exam: true, student: true, targetBeltRank: { with: { system: true } } } })
  if (!attempt || attempt.exam.organizationId !== session.user.organizationId) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  if (!await isDojoAccessible(session.user.id, session.user.organizationId, attempt.exam.dojoId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  if (attempt.gradingId) return { success: true, gradingId: attempt.gradingId }
  if (attempt.result !== 'passed' || !['paid', 'waived'].includes(attempt.paymentStatus)) throw createError({ statusCode: 400, statusMessage: 'Only passed candidates with a settled or waived grading fee can be awarded' })
  if (!attempt.targetBeltRank || attempt.targetBeltRank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Set a valid target rank before awarding promotion' })
  const [grading] = await db.insert(tables.studentGradings).values({ studentId: attempt.studentId, beltRankId: attempt.targetBeltRankId!, awardedDate: attempt.exam.scheduledAt, examiner: attempt.exam.name, notes: `Awarded from grading exam: ${attempt.exam.name}` }).returning()
  await db.update(tables.gradingExamAttempts).set({ gradingId: grading.id }).where(eq(tables.gradingExamAttempts.id, attempt.id))
  await syncCurrentBeltRank(attempt.studentId)
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'grading.awarded_from_exam', entityType: 'student_grading', entityId: grading.id, targetLabel: `${attempt.student.firstName} ${attempt.student.lastName} — ${attempt.targetBeltRank.name}`, scope: { type: 'dojo', id: attempt.exam.dojoId } })
  return { success: true, gradingId: grading.id }
})
