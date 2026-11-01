import { z } from 'zod'
import { and, eq, ne } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { tournamentStaff } from '../../../../utils/tournament-access'
import { tournamentRoster } from '../../../../utils/tournament-roster'

const schema = z.object({ eventType: z.enum(['kata', 'kumite']), beltDivision: z.enum(['colour', 'brown_black']), ageCategory: z.string().max(100).nullish(), weightCategory: z.string().max(100).nullish(), result: z.string().max(500).nullable().optional(), placeSecured: z.number().int().min(0).max(4).nullable().optional() })
export default defineEventHandler(async event => {
  const user = await tournamentStaff(event)
  const tournamentId = Number(getRouterParam(event, 'id'))
  const entryId = Number(getRouterParam(event, 'entryId'))
  const body = await readValidatedBody(event, schema.parse)
  const existing = (await tournamentRoster(user.id, user.organizationId, tournamentId)).find(entry => entry.id === entryId)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
  if (existing.participantId && (body.eventType !== existing.eventType || body.beltDivision !== existing.beltDivision || (body.ageCategory || null) !== existing.ageCategory || (body.weightCategory || null) !== existing.weightCategory)) {
    throw createError({ statusCode: 409, statusMessage: 'Edit participation details in tournament setup to change registered events or categories' })
  }
  if (!existing.participantId && existing.studentId && body.eventType !== existing.eventType) {
    const duplicate = await db.query.studentAchievements.findFirst({ where: and(eq(tables.studentAchievements.organizationId, user.organizationId), eq(tables.studentAchievements.tournamentId, tournamentId), eq(tables.studentAchievements.studentId, existing.studentId), eq(tables.studentAchievements.eventType, body.eventType), ne(tables.studentAchievements.id, entryId)) })
    if (duplicate) throw createError({ statusCode: 409, statusMessage: 'This student already has an entry in that event. Edit the existing event instead.' })
  }
  const place = body.placeSecured === undefined ? existing.placeSecured : body.placeSecured
  const medalType = place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 || place === 4 ? 'bronze' : null
  const values = existing.participantId ? { result: body.result, placeSecured: body.placeSecured } : body
  const [entry] = await db.update(tables.studentAchievements).set({ ...values, medalType, medalsWon: medalType ? 1 : 0 }).where(and(eq(tables.studentAchievements.id, entryId), eq(tables.studentAchievements.tournamentId, tournamentId), eq(tables.studentAchievements.organizationId, user.organizationId))).returning()
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
  return entry
})
