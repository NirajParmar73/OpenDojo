import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { getGradingEligibility } from '../../utils/grading-eligibility'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1).max(1000),
  name: z.string().trim().min(2).max(160),
  scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  registrationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  feeAmount: z.number().int().nonnegative(),
  paymentTiming: z.enum(['registration', 'exam_day']).default('exam_day'),
}).refine(body => !body.registrationDeadline || body.registrationDeadline <= body.scheduledAt, { message: 'Registration deadline must be on or before the exam date', path: ['registrationDeadline'] })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const userId = session.user.id
  const body = await readValidatedBody(event, schema.parse)
  const requestedIds = [...new Set(body.studentIds)]
  const eligibility = await getGradingEligibility(userId, organizationId)
  const candidatesById = new Map(eligibility.candidates.map(candidate => [candidate.studentId, candidate]))
  const accepted = requestedIds.map(id => candidatesById.get(id)).filter(candidate => candidate?.eligible && candidate.nextRankId)
  const skipped = requestedIds.filter(id => !accepted.some(candidate => candidate!.studentId === id)).map((id) => {
    const candidate = candidatesById.get(id)
    return { studentId: id, studentName: candidate?.studentName || 'Unavailable student', reasons: candidate?.reasons || ['Student is outside your scope or no longer available'] }
  })
  if (!accepted.length) throw createError({ statusCode: 409, statusMessage: 'None of the selected students are currently eligible' })

  const byDojo = new Map<number, typeof accepted>()
  for (const candidate of accepted) byDojo.set(candidate!.dojoId, [...(byDojo.get(candidate!.dojoId) || []), candidate])
  const atNoonUtc = (date: string) => new Date(`${date}T12:00:00.000Z`)
  const created = await db.transaction(async (tx) => {
    const results: Array<{ id: number, dojoId: number, dojoName: string, candidateCount: number }> = []
    for (const [dojoId, candidates] of byDojo) {
      const [exam] = await tx.insert(tables.gradingExams).values({ organizationId, dojoId, name: body.name, scheduledAt: atNoonUtc(body.scheduledAt), registrationDeadline: body.registrationDeadline ? atNoonUtc(body.registrationDeadline) : null, feeAmount: body.feeAmount, paymentTiming: body.paymentTiming, status: 'open' }).returning()
      if (!exam) throw createError({ statusCode: 500, statusMessage: 'Could not create grading exam' })
      await tx.insert(tables.gradingExamAttempts).values(candidates.map(candidate => ({ examId: exam.id, studentId: candidate!.studentId, targetBeltRankId: candidate!.nextRankId!, feeAmount: body.feeAmount, attendanceStatus: 'registered' as const })))
      results.push({ id: exam.id, dojoId, dojoName: candidates[0]!.dojoName, candidateCount: candidates.length })
    }
    return results
  })
  await Promise.all(created.map(exam => writeAuditLog({ organizationId, actorUserId: userId, action: 'grading_exam.bulk_scheduled', entityType: 'grading_exam', entityId: exam.id, targetLabel: body.name, scope: { type: 'dojo', id: exam.dojoId }, details: `${exam.candidateCount} eligible candidate${exam.candidateCount === 1 ? '' : 's'} registered.` })))
  return { success: true, exams: created, enrolled: accepted.length, skipped }
})
