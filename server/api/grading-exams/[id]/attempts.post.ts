import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../utils/permissions'

const schema = z.object({ studentId: z.number().int().positive(), targetBeltRankId: z.number().int().positive(), feeAmount: z.number().int().nonnegative() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event); const examId = Number(getRouterParam(event, 'id'))
  if (!session?.user?.organizationId || !examId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const exam = await db.query.gradingExams.findFirst({ where: and(eq(tables.gradingExams.id, examId), eq(tables.gradingExams.organizationId, session.user.organizationId)) })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, body.studentId), eq(tables.students.organizationId, session.user.organizationId), eq(tables.students.dojoId, exam?.dojoId || -1)), with: { currentBeltRank: true } }) as any
  if (!exam || !student || !await isDojoAccessible(session.user.id, session.user.organizationId, exam.dojoId)) throw createError({ statusCode: 400, statusMessage: 'Student must belong to this exam dojo' })
  const rank = await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, body.targetBeltRankId), with: { system: true } }) as any
  if (!rank || rank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid target rank' })
  if (student.currentBeltRank && (rank.systemId !== student.currentBeltRank.systemId || rank.order <= student.currentBeltRank.order)) {
    throw createError({ statusCode: 400, statusMessage: 'Target rank must be higher than the student’s current belt in the same belt structure' })
  }
  const [attempt] = await db.insert(tables.gradingExamAttempts).values({ examId, studentId: student.id, targetBeltRankId: body.targetBeltRankId, feeAmount: body.feeAmount }).returning()
  return attempt
})
