import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })
  const [tournament] = await db.delete(tables.tournaments)
    .where(and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, session.user.organizationId)))
    .returning({ id: tables.tournaments.id })

  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  return { success: true }
})
