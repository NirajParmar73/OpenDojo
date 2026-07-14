import { desc, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return db.query.tournaments.findMany({ where: eq(tables.tournaments.organizationId, session.user.organizationId), orderBy: [desc(tables.tournaments.startDate)] })
})
