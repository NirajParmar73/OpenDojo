import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { tournamentStaff, staffTournament } from '../../../utils/tournament-access'
import { getAccessibleDojoIds } from '../../../utils/permissions'

const schema = z.object({ studentId: z.number().int().positive(), eventType: z.enum(['kata', 'kumite']), beltDivision: z.enum(['colour', 'brown_black']).default('colour'), ageCategory: z.string().max(100).optional(), weightCategory: z.string().max(100).optional() })
export default defineEventHandler(async event => {
  const user = await tournamentStaff(event)
  const id = Number(getRouterParam(event, 'id'))
  const target = await staffTournament(user.organizationId, id, user)
  const body = await readValidatedBody(event, schema.parse)
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, body.studentId), eq(tables.students.organizationId, user.organizationId)) })
  const accessible = await getAccessibleDojoIds(user.id, user.organizationId)
  if (!student || (accessible !== null && (student.dojoId === null || !accessible.includes(student.dojoId)))) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (target.dojoIds.length && (student.dojoId === null || !target.dojoIds.includes(student.dojoId))) throw createError({ statusCode: 403, statusMessage: 'Choose a student from this tournament\'s locations' })
  return db.transaction(async tx => {
    const [tournament] = await tx.select().from(tables.tournaments).where(and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, user.organizationId))).for('update')
    if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
    const registration = await tx.query.tournamentParticipants.findFirst({ where: and(eq(tables.tournamentParticipants.tournamentId, id), eq(tables.tournamentParticipants.studentId, student.id)) })
    if (registration) throw createError({ statusCode: 409, statusMessage: 'This student has a public registration. Edit their participation details to change events.' })
    const duplicate = await tx.query.studentAchievements.findFirst({ where: and(eq(tables.studentAchievements.tournamentId, id), eq(tables.studentAchievements.studentId, student.id), eq(tables.studentAchievements.eventType, body.eventType)) })
    if (duplicate) throw createError({ statusCode: 409, statusMessage: 'This student is already entered in this event' })
    const [entry] = await tx.insert(tables.studentAchievements).values({ organizationId: user.organizationId, studentId: student.id, tournamentId: id, tournamentName: tournament.name, tournamentLevel: tournament.level, venue: tournament.venue, startDate: tournament.startDate, endDate: tournament.endDate, eventType: body.eventType, beltDivision: body.beltDivision, ageCategory: body.ageCategory || null, weightCategory: body.weightCategory || null, createdBy: user.id }).returning()
    return entry
  })
})
