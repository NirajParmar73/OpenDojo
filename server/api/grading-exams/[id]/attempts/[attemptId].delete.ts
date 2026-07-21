import { db, tables } from '../../../../utils/database'
import { and, eq } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../utils/permissions'

export default defineEventHandler(async event => {
  const session = await getUserSession(event); const examId = Number(getRouterParam(event, 'id')); const attemptId = Number(getRouterParam(event, 'attemptId'))
  if (!session?.user?.organizationId || !examId || !attemptId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const exam = await db.query.gradingExams.findFirst({ where: and(eq(tables.gradingExams.id, examId), eq(tables.gradingExams.organizationId, session.user.organizationId)) })
  const attempt = await db.query.gradingExamAttempts.findFirst({ where: and(eq(tables.gradingExamAttempts.id, attemptId), eq(tables.gradingExamAttempts.examId, examId)) })
  if (!exam || !attempt || !await isDojoAccessible(session.user.id, session.user.organizationId, exam.dojoId)) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
  if (attempt.gradingId) throw createError({ statusCode: 400, statusMessage: 'This candidate has already been promoted. Remove the grading record first if it was entered in error.' })
  await db.delete(tables.gradingExamAttempts).where(eq(tables.gradingExamAttempts.id, attemptId))
  return { success: true }
})
