import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { tournamentStaff, staffTournament } from '../../utils/tournament-access'
import { tournamentSchema } from '../../utils/tournament-validation'
import { createTournamentRegistrationToken } from '../../utils/tournament-registration'

export default defineEventHandler(async (event) => {
  const user = await tournamentStaff(event, true)
  const id = Number(getRouterParam(event, 'id'))
  const existing = await staffTournament(user.organizationId, id)
  const body = await readValidatedBody(event, tournamentSchema.parse)
  return db.transaction(async tx => {
    const values = { ...body, venue: body.venue || null, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null, ageCutoffDate: new Date(body.ageCutoffDate) }
    const [tournament] = await tx.update(tables.tournaments).set({ ...values, registrationToken: existing.registrationToken || createTournamentRegistrationToken() }).where(and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, user.organizationId))).returning()
    if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
    await tx.update(tables.studentAchievements).set({ tournamentName: body.name, tournamentLevel: body.level, venue: values.venue, startDate: values.startDate, endDate: values.endDate }).where(and(eq(tables.studentAchievements.tournamentId, id), eq(tables.studentAchievements.organizationId, user.organizationId)))
    return tournament
  })
})
