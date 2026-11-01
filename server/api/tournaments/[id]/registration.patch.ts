import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { staffTournament, tournamentStaff } from '../../../utils/tournament-access'
import { createTournamentRegistrationToken } from '../../../utils/tournament-registration'

export default defineEventHandler(async event => {
  const user = await tournamentStaff(event, true)
  const id = Number(getRouterParam(event, 'id'))
  const tournament = await staffTournament(user.organizationId, id, user, true)
  const body = await readValidatedBody(event, z.object({ enabled: z.boolean() }).parse)
  const [updated] = await db.update(tables.tournaments).set({ registrationEnabled: body.enabled, registrationToken: tournament.registrationToken || createTournamentRegistrationToken() }).where(and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, user.organizationId))).returning()
  return updated
})
