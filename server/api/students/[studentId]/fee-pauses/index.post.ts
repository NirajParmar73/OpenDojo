import { eq } from 'drizzle-orm'
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
  const body = await readValidatedBody(event, schema.parse)
  const dates = parseFeePauseDates(body.startDate, body.endDate)
  const existing = await db.query.studentFeePauses.findMany({ where: eq(tables.studentFeePauses.studentId, studentId) })
  if (existing.some(pause => feePausesOverlap(pause, dates))) {
    throw createError({ statusCode: 409, statusMessage: 'This vacation overlaps an existing fee pause' })
  }

  const [pause] = await db.insert(tables.studentFeePauses).values({
    studentId,
    startDate: dates.start,
    endDate: dates.end,
    reason: body.reason,
    createdBy: user.id,
  }).returning()
  if (!pause) throw createError({ statusCode: 500, statusMessage: 'Failed to create fee pause' })

  await writeAuditLog({ organizationId, actorUserId: user.id, action: 'student.fee_pause.created', entityType: 'student_fee_pause', entityId: pause.id, targetLabel: `${student.firstName} ${student.lastName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' }, details: `${body.startDate} to ${body.endDate || 'open-ended'}: ${body.reason}` })
  return { success: true, pause }
})
