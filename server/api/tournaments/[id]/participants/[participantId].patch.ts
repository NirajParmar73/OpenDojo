import { staffTournament, tournamentStaff } from '../../../../utils/tournament-access'
import { updateTournamentParticipant } from '../../../../utils/tournament-registration'

export default defineEventHandler(async event => {
  const user = await tournamentStaff(event, true)
  const id = Number(getRouterParam(event, 'id'))
  await staffTournament(user.organizationId, id)
  return updateTournamentParticipant(user.organizationId, id, Number(getRouterParam(event, 'participantId')), await readBody(event))
})
