import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return db.query.governingBodies.findMany({ where: eq(tables.governingBodies.organizationId, session.user.organizationId) })
})
