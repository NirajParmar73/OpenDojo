import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { tournamentStaff } from '../../../../utils/tournament-access'
import { tournamentRoster } from '../../../../utils/tournament-roster'

export default defineEventHandler(async event => {
  const user = await tournamentStaff(event)
  const tournamentId = Number(getRouterParam(event, 'id'))
  const entryId = Number(getRouterParam(event, 'entryId'))
  const existing = (await tournamentRoster(user.id, user.organizationId, tournamentId)).find(entry => entry.id === entryId)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
  if (existing.participantId) throw createError({ statusCode: 409, statusMessage: 'Edit or remove this player through participation details in tournament setup' })
  await db.delete(tables.studentAchievements).where(and(eq(tables.studentAchievements.id, entryId), eq(tables.studentAchievements.tournamentId, tournamentId), eq(tables.studentAchievements.organizationId, user.organizationId)))
  return { success: true }
})
