import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { allowedDocumentTypes, saveUploadedFile } from '../../../../utils/upload'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  if (!studentId) throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })

  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'Invalid achievement data' })
  const field = (name: string) => form.find(part => part.name === name && !part.filename)?.data.toString().trim() || ''
  const tournamentName = field('tournamentName')
  const tournamentLevel = field('tournamentLevel')
  const startDate = field('startDate')
  if (!tournamentName || !tournamentLevel || !startDate || Number.isNaN(new Date(startDate).getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Tournament name, level, and start date are required' })
  }
  const endDate = field('endDate')
  if (endDate && Number.isNaN(new Date(endDate).getTime())) throw createError({ statusCode: 400, statusMessage: 'Invalid end date' })
  const medalsValue = field('medalsWon')
  const medalsWon = medalsValue ? Number(medalsValue) : 0
  if (!Number.isInteger(medalsWon) || medalsWon < 0) throw createError({ statusCode: 400, statusMessage: 'Medals won must be a non-negative whole number' })

  const certificate = form.find(part => part.name === 'certificate' && part.filename)
  const savedCertificate = certificate?.data ? await saveUploadedFile({
    name: certificate.filename || 'achievement-certificate', data: certificate.data, filename: certificate.filename || 'certificate', type: certificate.type || 'application/pdf'
  }, 'achievement-certificates', allowedDocumentTypes) : null

  const tournamentStartDate = new Date(startDate)
  let tournament = await db.query.tournaments.findFirst({
    where: and(
      eq(tables.tournaments.organizationId, session.user.organizationId),
      eq(tables.tournaments.name, tournamentName),
      eq(tables.tournaments.level, tournamentLevel),
      eq(tables.tournaments.startDate, tournamentStartDate)
    )
  })
  if (!tournament) {
    const [createdTournament] = await db.insert(tables.tournaments).values({
      organizationId: session.user.organizationId,
      name: tournamentName,
      level: tournamentLevel,
      venue: field('venue') || null,
      startDate: tournamentStartDate,
      endDate: endDate ? new Date(endDate) : null,
    }).returning()
    tournament = createdTournament
  }

  const [achievement] = await db.insert(tables.studentAchievements).values({
    organizationId: session.user.organizationId,
    studentId,
    tournamentId: tournament!.id,
    tournamentName,
    tournamentLevel,
    venue: field('venue') || null,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    eventType: field('eventType') || null,
    ageCategory: field('ageCategory') || null,
    weightCategory: field('weightCategory') || null,
    result: field('result') || null,
    medalType: field('medalType') || null,
    medalsWon,
    certificateUrl: savedCertificate?.path || null,
    notes: field('notes') || null,
    createdBy: session.user.id,
  }).returning()
  await writeAuditLog({
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    action: 'achievement.recorded',
    entityType: 'student_achievement',
    entityId: achievement.id,
    targetLabel: `${student.firstName} ${student.lastName} — ${tournamentName}`,
    scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
    details: [tournamentLevel, field('result'), field('medalType')].filter(Boolean).join(' | ') || null,
  })
  return { success: true, achievement }
})
