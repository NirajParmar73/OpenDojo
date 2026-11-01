import { desc, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { tournamentStaff } from '../../utils/tournament-access'
import { canManageTournament, canViewTournament } from '../../../shared/utils/tournament-access'
export default defineEventHandler(async event => {
  const user = await tournamentStaff(event)
  const tournaments = await db.query.tournaments.findMany({ where: eq(tables.tournaments.organizationId, user.organizationId), orderBy: [desc(tables.tournaments.startDate)] })
  return tournaments.filter(tournament => canViewTournament(user, tournament)).map(tournament => ({ ...tournament, canManage: canManageTournament(user, tournament), canExport: user.manager, registrationToken: canManageTournament(user, tournament) ? tournament.registrationToken : null }))
})
