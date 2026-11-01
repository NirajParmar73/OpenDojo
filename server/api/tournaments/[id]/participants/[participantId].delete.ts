import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { staffTournament, tournamentStaff } from '../../../../utils/tournament-access'

export default defineEventHandler(async event => {
  const user = await tournamentStaff(event, true)
  const id = Number(getRouterParam(event, 'id'))
  await staffTournament(user.organizationId, id)
  const participantId = Number(getRouterParam(event, 'participantId'))
  if (!Number.isSafeInteger(participantId) || participantId <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid participant' })
  const [deleted] = await db.delete(tables.tournamentParticipants).where(and(eq(tables.tournamentParticipants.id, participantId), eq(tables.tournamentParticipants.tournamentId, id), eq(tables.tournamentParticipants.organizationId, user.organizationId))).returning({ id: tables.tournamentParticipants.id })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Participant not found' })
  return { success: true }
})
