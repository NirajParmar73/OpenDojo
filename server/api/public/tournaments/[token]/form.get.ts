import { publicTournament } from '../../../../utils/tournament-access'
import { tournamentBelts } from '../../../../utils/tournament-belts'

export default defineEventHandler(async event => {
  const tournament = await publicTournament(event, getRouterParam(event, 'token') || '')
  return {
    organizationName: tournament.organization.name,
    beltOptions: await tournamentBelts(tournament.organizationId),
    tournament: { name: tournament.name, level: tournament.level, venue: tournament.venue, startDate: tournament.startDate, endDate: tournament.endDate, ageCutoffDate: tournament.ageCutoffDate || tournament.startDate, coachName: tournament.coachName, registrationEnabled: tournament.registrationEnabled },
  }
})
