import { buildTournamentReport } from '../../../../utils/tournament-report'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const tournamentId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(tournamentId)) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })
  return await buildTournamentReport(session.user.id, session.user.organizationId, tournamentId)
})
