import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../utils/permissions'
import { getStudentSyllabusProgress } from '../../../utils/syllabus'

const schema = z.object({ studentId: z.number().int().positive(), targetBeltRankId: z.number().int().positive(), feeAmount: z.number().int().nonnegative() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event); const examId = Number(getRouterParam(event, 'id'))
  if (!session?.user?.organizationId || !examId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const body = await readValidatedBody(event, schema.parse)
  const exam = await db.query.gradingExams.findFirst({ where: and(eq(tables.gradingExams.id, examId), eq(tables.gradingExams.organizationId, session.user.organizationId)) })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, body.studentId), eq(tables.students.organizationId, session.user.organizationId), eq(tables.students.dojoId, exam?.dojoId || -1)), with: { currentBeltRank: true } }) as any
  if (!exam || !student || !await isDojoAccessible(session.user.id, session.user.organizationId, exam.dojoId)) throw createError({ statusCode: 400, statusMessage: 'Student must belong to this exam dojo' })
  const rank = await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, body.targetBeltRankId), with: { system: true } }) as any
  if (!rank || rank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid target rank' })
  if (student.currentBeltRank && (rank.systemId !== student.currentBeltRank.systemId || rank.order <= student.currentBeltRank.order)) {
    throw createError({ statusCode: 400, statusMessage: 'Target rank must be higher than the student’s current belt in the same belt structure' })
  }
  const progress = await getStudentSyllabusProgress(student.id, organizationId)
  if (!progress?.targetRank || progress.targetRank.id !== body.targetBeltRankId) throw createError({ statusCode: 409, statusMessage: 'Only the student’s next belt can be selected' })
  if (!progress.ready) throw createError({ statusCode: 409, statusMessage: progress.reason || `${progress.completed}/${progress.total} required syllabus items are ready` })
  const since = new Date(); since.setDate(since.getDate() - 90)
  const [attendance, attempts] = await Promise.all([
    db.query.attendance.findMany({ where: eq(tables.attendance.studentId, student.id), with: { session: true } }),
    db.query.gradingExamAttempts.findMany({ where: eq(tables.gradingExamAttempts.studentId, student.id), with: { exam: true } }),
  ])
  const recent = attendance.filter(record => record.session.date >= since)
  const attended = recent.filter(record => record.status === 'present' || record.status === 'late').length
  const rate = recent.length ? Math.round((attended / recent.length) * 100) : 0
  if (recent.length < 4 || rate < 80) throw createError({ statusCode: 409, statusMessage: 'The student does not yet meet the attendance requirement' })
  if (attempts.some((attempt: any) => attempt.paymentStatus === 'pending' && attempt.exam.organizationId === organizationId && !['withdrawn', 'absent'].includes(attempt.attendanceStatus))) throw createError({ statusCode: 409, statusMessage: 'The student has a pending grading fee' })
  if (attempts.some((attempt: any) => attempt.exam.organizationId === organizationId && ['draft', 'open'].includes(attempt.exam.status) && ['registered', 'confirmed', 'appeared'].includes(attempt.attendanceStatus))) throw createError({ statusCode: 409, statusMessage: 'The student is already registered for an open grading exam' })
  const [attempt] = await db.insert(tables.gradingExamAttempts).values({ examId, studentId: student.id, targetBeltRankId: body.targetBeltRankId, feeAmount: body.feeAmount }).returning()
  return attempt
})
