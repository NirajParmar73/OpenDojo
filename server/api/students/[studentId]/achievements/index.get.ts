import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  return db.query.studentAchievements.findMany({
    where: and(eq(tables.studentAchievements.studentId, studentId), eq(tables.studentAchievements.organizationId, session.user.organizationId)),
    orderBy: (achievement, { desc }) => [desc(achievement.startDate)],
  })
})
