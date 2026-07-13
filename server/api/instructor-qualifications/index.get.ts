import { db, tables } from '../../utils/database'
import { and, eq } from 'drizzle-orm'
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const userId = Number(getQuery(event).userId) || null
  return db.query.instructorQualifications.findMany({ where: userId ? and(eq(tables.instructorQualifications.organizationId, session.user.organizationId), eq(tables.instructorQualifications.userId, userId)) : eq(tables.instructorQualifications.organizationId, session.user.organizationId) })
})
