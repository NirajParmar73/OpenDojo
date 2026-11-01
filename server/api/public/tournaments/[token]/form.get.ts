import { publicTournament } from '../../../../utils/tournament-access'

export default defineEventHandler(async event => {
  const tournament = await publicTournament(event, getRouterParam(event, 'token') || '')
  return {
    organizationName: tournament.organization.name,
    tournament: { name: tournament.name, level: tournament.level, venue: tournament.venue, startDate: tournament.startDate, endDate: tournament.endDate, ageCutoffDate: tournament.ageCutoffDate || tournament.startDate, coachName: tournament.coachName, registrationEnabled: tournament.registrationEnabled },
  }
})
