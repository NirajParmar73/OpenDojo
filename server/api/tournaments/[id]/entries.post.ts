import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
const schema = z.object({ studentId: z.number().int().positive(), eventType: z.enum(['kata', 'kumite']), beltDivision: z.enum(['colour', 'brown_black']).default('colour'), ageCategory: z.string().optional(), weightCategory: z.string().optional() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event); if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id')); const body = await readValidatedBody(event, schema.parse)
  const tournament = await db.query.tournaments.findFirst({ where: and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, session.user.organizationId)) }); const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, body.studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!tournament || !student) throw createError({ statusCode: 404, statusMessage: 'Tournament or student not found' })
  const [entry] = await db.insert(tables.studentAchievements).values({ organizationId: session.user.organizationId, studentId: student.id, tournamentId: id, tournamentName: tournament.name, tournamentLevel: tournament.level, venue: tournament.venue, startDate: tournament.startDate, endDate: tournament.endDate, eventType: body.eventType, beltDivision: body.beltDivision, ageCategory: body.ageCategory || null, weightCategory: body.weightCategory || null, medalsWon: 0, createdBy: session.user.id }).returning()
  return entry
})
