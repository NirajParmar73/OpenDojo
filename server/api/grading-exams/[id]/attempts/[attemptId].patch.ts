import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../utils/permissions'

const schema = z.object({ targetBeltRankId: z.number().int().positive().nullable().optional(), feeAmount: z.number().int().nonnegative().optional(), attendanceStatus: z.enum(['registered', 'appeared', 'absent', 'withdrawn']).optional(), result: z.enum(['pending', 'passed', 'failed']).optional(), paymentStatus: z.enum(['pending', 'paid', 'waived', 'refunded']).optional(), paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'other']).nullable().optional(), paymentReference: z.string().nullable().optional(), waiverReason: z.string().nullable().optional(), notes: z.string().nullable().optional() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event); const examId = Number(getRouterParam(event, 'id')); const attemptId = Number(getRouterParam(event, 'attemptId'))
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const exam = await db.query.gradingExams.findFirst({ where: and(eq(tables.gradingExams.id, examId), eq(tables.gradingExams.organizationId, session.user.organizationId)) })
  if (!exam || !await isDojoAccessible(session.user.id, session.user.organizationId, exam.dojoId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  if (body.targetBeltRankId) {
    const existingAttempt = await db.query.gradingExamAttempts.findFirst({ where: and(eq(tables.gradingExamAttempts.id, attemptId), eq(tables.gradingExamAttempts.examId, examId)), with: { student: { with: { currentBeltRank: true } } } }) as any
    if (!existingAttempt) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' })
    const rank = await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, body.targetBeltRankId), with: { system: true } }) as any
    if (!rank || rank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid target rank' })
    if (existingAttempt.student.currentBeltRank && (rank.systemId !== existingAttempt.student.currentBeltRank.systemId || rank.order <= existingAttempt.student.currentBeltRank.order)) {
      throw createError({ statusCode: 400, statusMessage: 'Target rank must be higher than the student’s current belt in the same belt structure' })
    }
  }
  const patch: any = { ...body }
  if (body.paymentStatus === 'paid') {
    patch.paidAt = new Date()
    // Exam-day collection is usually cash; staff can still override it later.
    if (body.paymentMethod === undefined) patch.paymentMethod = 'cash'
  }
  if (body.paymentStatus !== undefined && body.paymentStatus !== 'paid') patch.paidAt = null
  const [attempt] = await db.update(tables.gradingExamAttempts).set(patch).where(and(eq(tables.gradingExamAttempts.id, attemptId), eq(tables.gradingExamAttempts.examId, examId))).returning()
  if (!attempt) throw createError({ statusCode: 404, statusMessage: 'Candidate not found' }); return attempt
})
