import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { getAccessibleDojoIds } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const accessible = await getAccessibleDojoIds(session.user.id, session.user.organizationId)
  const exams = await db.query.gradingExams.findMany({
    where: eq(tables.gradingExams.organizationId, session.user.organizationId),
    with: { dojo: true, attempts: { with: { student: true, targetBeltRank: true } } },
    orderBy: (exam, { desc }) => [desc(exam.scheduledAt)],
  })
  return accessible === null ? exams : exams.filter(exam => accessible.includes(exam.dojoId))
})
