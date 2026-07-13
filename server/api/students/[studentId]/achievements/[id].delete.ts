import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const achievementId = Number(getRouterParam(event, 'id'))
  if (!studentId || !achievementId) throw createError({ statusCode: 400, statusMessage: 'Missing achievement ID' })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const [deleted] = await db.delete(tables.studentAchievements).where(and(eq(tables.studentAchievements.id, achievementId), eq(tables.studentAchievements.studentId, studentId), eq(tables.studentAchievements.organizationId, session.user.organizationId))).returning()
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Achievement not found' })
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'achievement.deleted', entityType: 'student_achievement', entityId: deleted.id, targetLabel: `${student.firstName} ${student.lastName} — ${deleted.tournamentName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' } })
  return { success: true }
})
