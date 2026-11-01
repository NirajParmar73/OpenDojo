import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { tournamentStaff, staffTournament } from '../../utils/tournament-access'

export default defineEventHandler(async (event) => {
  const user = await tournamentStaff(event, true)

  const id = Number(getRouterParam(event, 'id'))
  await staffTournament(user.organizationId, id, user, true)
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })
  const [tournament] = await db.delete(tables.tournaments)
    .where(and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, user.organizationId)))
    .returning({ id: tables.tournaments.id })

  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  return { success: true }
})
