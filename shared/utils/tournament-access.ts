export const tournamentManagerRoles = ['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor']

export type TournamentScopeActor = { dojoIds: number[] | null, manager: boolean }
export type TournamentScope = { dojoIds: number[] }

export function canManageTournament(actor: TournamentScopeActor, tournament: TournamentScope) {
  return actor.manager && (actor.dojoIds === null || (tournament.dojoIds.length > 0 && tournament.dojoIds.every(id => actor.dojoIds!.includes(id))))
}

export function canViewTournament(actor: TournamentScopeActor, tournament: TournamentScope) {
  return actor.dojoIds === null || !tournament.dojoIds.length || tournament.dojoIds.some(id => actor.dojoIds!.includes(id))
}

export function canViewTournamentEntry(actor: TournamentScopeActor, tournament: TournamentScope, entry: { participantId: number | null, student: { dojoId: number | null } | null }) {
  if (!canViewTournament(actor, tournament)) return false
  if (actor.dojoIds === null) return true
  if (entry.participantId && canManageTournament(actor, tournament)) return true
  const dojoId = entry.student?.dojoId
  return dojoId != null && actor.dojoIds.includes(dojoId) && (!tournament.dojoIds.length || tournament.dojoIds.includes(dojoId))
}
