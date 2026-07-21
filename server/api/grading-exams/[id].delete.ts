import { db, tables } from '../../utils/database'
import { and, eq } from 'drizzle-orm'
import { isDojoAccessible } from '../../utils/permissions'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async event => {
  const session = await getUserSession(event); const id = Number(getRouterParam(event, 'id'))
  if (!session?.user?.organizationId || !id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const exam = await db.query.gradingExams.findFirst({ where: and(eq(tables.gradingExams.id, id), eq(tables.gradingExams.organizationId, session.user.organizationId)), with: { attempts: true } })
  if (!exam || !await isDojoAccessible(session.user.id, session.user.organizationId, exam.dojoId)) throw createError({ statusCode: 404, statusMessage: 'Grading exam not found' })
  if (exam.attempts.some(attempt => attempt.gradingId)) throw createError({ statusCode: 400, statusMessage: 'This exam has awarded promotions and cannot be deleted. Cancel it instead.' })
  await db.delete(tables.gradingExams).where(eq(tables.gradingExams.id, id))
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'grading_exam.deleted', entityType: 'grading_exam', entityId: id, targetLabel: exam.name, scope: { type: 'dojo', id: exam.dojoId } })
  return { success: true }
})
