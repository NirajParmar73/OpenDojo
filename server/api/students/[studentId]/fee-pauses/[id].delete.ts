import { and, eq } from 'drizzle-orm'
import { writeAuditLog } from '../../../../utils/audit'
import { db, tables } from '../../../../utils/database'
import { requireFeePauseStudent } from '../../../../utils/student-fee-pauses'

export default defineEventHandler(async (event) => {
  const { user, organizationId, studentId, student } = await requireFeePauseStudent(event, 'manage')
  const pauseId = Number(getRouterParam(event, 'id'))
  const pause = pauseId ? await db.query.studentFeePauses.findFirst({ where: and(eq(tables.studentFeePauses.id, pauseId), eq(tables.studentFeePauses.studentId, studentId)) }) : null
  if (!pause) throw createError({ statusCode: 404, statusMessage: 'Fee pause not found' })

  await db.delete(tables.studentFeePauses).where(eq(tables.studentFeePauses.id, pauseId))
  await writeAuditLog({ organizationId, actorUserId: user.id, action: 'student.fee_pause.deleted', entityType: 'student_fee_pause', entityId: pauseId, targetLabel: `${student.firstName} ${student.lastName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' }, details: `${pause.startDate.toISOString()} to ${pause.endDate?.toISOString() || 'open-ended'}` })
  return { success: true }
})
