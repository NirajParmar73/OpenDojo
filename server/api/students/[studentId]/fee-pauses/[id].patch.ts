import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { writeAuditLog } from '../../../../utils/audit'
import { db, tables } from '../../../../utils/database'
import { feePausesOverlap, parseFeePauseDates, requireFeePauseStudent } from '../../../../utils/student-fee-pauses'

const schema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date().nullable().optional(),
  reason: z.string().trim().min(1).max(500),
})

export default defineEventHandler(async (event) => {
  const { user, organizationId, studentId, student } = await requireFeePauseStudent(event, 'manage')
  const pauseId = Number(getRouterParam(event, 'id'))
  if (!pauseId) throw createError({ statusCode: 400, statusMessage: 'Invalid fee pause' })
  const current = await db.query.studentFeePauses.findFirst({ where: and(eq(tables.studentFeePauses.id, pauseId), eq(tables.studentFeePauses.studentId, studentId)) })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Fee pause not found' })

  const body = await readValidatedBody(event, schema.parse)
  const dates = parseFeePauseDates(body.startDate, body.endDate)
  const others = await db.query.studentFeePauses.findMany({ where: and(eq(tables.studentFeePauses.studentId, studentId), ne(tables.studentFeePauses.id, pauseId)) })
  if (others.some(pause => feePausesOverlap(pause, dates))) throw createError({ statusCode: 409, statusMessage: 'This vacation overlaps an existing fee pause' })

  const [pause] = await db.update(tables.studentFeePauses).set({ startDate: dates.start, endDate: dates.end, reason: body.reason, updatedAt: new Date() }).where(eq(tables.studentFeePauses.id, pauseId)).returning()
  await writeAuditLog({ organizationId, actorUserId: user.id, action: 'student.fee_pause.updated', entityType: 'student_fee_pause', entityId: pauseId, targetLabel: `${student.firstName} ${student.lastName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' }, details: `${body.startDate} to ${body.endDate || 'open-ended'}: ${body.reason}` })
  return { success: true, pause }
})
