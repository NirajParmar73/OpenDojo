import { publicTournament } from '../../../../utils/tournament-access'
import { submitTournamentParticipant } from '../../../../utils/tournament-registration'

export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') || ''
  const tournament = await publicTournament(event, token)
  return submitTournamentParticipant(tournament.id, token, await readBody(event))
})
