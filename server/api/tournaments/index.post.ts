import { db, tables } from '../../utils/database'
import { tournamentStaff } from '../../utils/tournament-access'
import { tournamentSchema } from '../../utils/tournament-validation'
import { createTournamentRegistrationToken } from '../../utils/tournament-registration'
export default defineEventHandler(async event => {
  const user = await tournamentStaff(event, true)
  const body = await readValidatedBody(event, tournamentSchema.parse)
  const organization = await db.query.organizations.findFirst({ where: (table, { eq }) => eq(table.id, user.organizationId) })
  const [tournament] = await db.insert(tables.tournaments).values({
    ...body, organizationId: user.organizationId,
    participantListTitle: body.participantListTitle || `${organization?.name || ''} Participant List`.trim(),
    registrationToken: createTournamentRegistrationToken(), venue: body.venue || null,
    startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null, ageCutoffDate: new Date(body.ageCutoffDate),
  }).returning()
  return tournament
})
