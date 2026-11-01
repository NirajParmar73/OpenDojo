import { desc, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { tournamentStaff } from '../../utils/tournament-access'
export default defineEventHandler(async event => {
  const user = await tournamentStaff(event)
  const tournaments = await db.query.tournaments.findMany({ where: eq(tables.tournaments.organizationId, user.organizationId), orderBy: [desc(tables.tournaments.startDate)] })
  return tournaments.map(tournament => ({ ...tournament, registrationToken: ['owner', 'admin'].includes(user.role) ? tournament.registrationToken : null }))
})
