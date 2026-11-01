import { randomBytes } from 'node:crypto'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db, tables } from './database'
import { participantSchema, publicParticipantSchema } from './tournament-validation'
import { beltDivision, participantIdentity, tournamentAge } from '../../shared/utils/tournament-participation'
import { tournamentBelts } from './tournament-belts'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function registrationReceipt(participant: { id: number }) {
  return { reference: `TP-${String(participant.id).padStart(6, '0')}` }
}

export async function submitTournamentParticipant(tournamentId: number, token: string, input: unknown) {
  const parsed = publicParticipantSchema.safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(issue => issue.message).join('; ') })
  const body = parsed.data
  return db.transaction(async tx => {
    // Serialize submissions, closing registration, and profile edits for this tournament.
    const [tournament] = await tx.select().from(tables.tournaments).where(and(eq(tables.tournaments.id, tournamentId), eq(tables.tournaments.registrationToken, token))).for('update')
    if (!tournament) throw createError({ statusCode: 404, statusMessage: 'This participation form is unavailable' })
    const prior = await tx.query.tournamentParticipants.findFirst({ where: and(eq(tables.tournamentParticipants.tournamentId, tournamentId), eq(tables.tournamentParticipants.requestKey, body.requestKey)) })
    if (prior) return registrationReceipt(prior)
    if (!tournament.registrationEnabled) throw createError({ statusCode: 409, statusMessage: 'Registration is closed for this tournament' })
    validateBirthDate(body.dateOfBirth, tournament.ageCutoffDate || tournament.startDate)
    const identityKey = participantIdentity(body.fullName, body.dateOfBirth)
    const duplicate = await tx.query.tournamentParticipants.findFirst({ where: and(eq(tables.tournamentParticipants.tournamentId, tournamentId), eq(tables.tournamentParticipants.identityKey, identityKey)) })
    if (duplicate) throw createError({ statusCode: 409, statusMessage: 'A registration for this player already exists. Contact the tournament administrator for corrections.' })
    const division = await validatedBeltDivision(tx, tournament.organizationId, body.belt)
    // Anonymous submissions never admit a new student or change a student profile.
    const studentId = await matchingStudentId(tx, tournament.organizationId, body.fullName, body.dateOfBirth, tournament.dojoIds)
    const [participant] = await tx.insert(tables.tournamentParticipants).values({
      organizationId: tournament.organizationId, tournamentId, studentId,
      fullName: body.fullName, dateOfBirth: body.dateOfBirth, gender: body.gender,
      weightKg: body.weightKg, belt: body.belt, ageCategory: body.ageCategory,
      requestKey: body.requestKey, identityKey, consentAt: new Date(),
    }).returning()
    await syncParticipantEntries(tx, tournament, participant!, body, division)
    return registrationReceipt(participant!)
  })
}

function validateBirthDate(dateOfBirth: string, cutoff: Date) {
  const age = tournamentAge(dateOfBirth, cutoff)
  if (dateOfBirth > new Date().toISOString().slice(0, 10) || age < 0 || age > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid birth date on or before the age cut-off date' })
  }
}

async function matchingStudentId(tx: Transaction, organizationId: number, name: string, dateOfBirth: string, dojoIds: number[]) {
  const possibleStudents = await tx.query.students.findMany({ where: and(eq(tables.students.organizationId, organizationId), dojoIds.length ? inArray(tables.students.dojoId, dojoIds) : undefined, sql`(${tables.students.dateOfBirth} AT TIME ZONE 'UTC')::date = ${dateOfBirth}::date`) })
  const identityKey = participantIdentity(name, dateOfBirth)
  const matches = possibleStudents.filter(student => participantIdentity(`${student.firstName} ${student.lastName}`, dateOfBirth) === identityKey)
  return matches.length === 1 ? matches[0]!.id : null
}

async function validatedBeltDivision(tx: Transaction, organizationId: number, belt: string, previous?: typeof tables.tournamentParticipants.$inferSelect) {
  const option = (await tournamentBelts(organizationId, tx)).find(option => option.value === belt)
  if (option) return option.division
  // Keep historical registrations editable when a configured rank is renamed or removed.
  if (previous?.belt === belt) {
    const entry = await tx.query.studentAchievements.findFirst({ where: and(eq(tables.studentAchievements.organizationId, organizationId), eq(tables.studentAchievements.participantId, previous.id)) })
    return entry?.beltDivision === 'brown_black' ? 'brown_black' : entry?.beltDivision === 'colour' ? 'colour' : beltDivision(belt)
  }
  throw createError({ statusCode: 400, statusMessage: 'Select a belt from this organization\'s current belt system. Reload the form if the list has changed.' })
}

async function syncParticipantEntries(tx: Transaction, tournament: typeof tables.tournaments.$inferSelect, participant: typeof tables.tournamentParticipants.$inferSelect, body: { kata: boolean, kumite: boolean }, division: 'colour' | 'brown_black') {
  const existing = await tx.query.studentAchievements.findMany({ where: and(eq(tables.studentAchievements.tournamentId, tournament.id), eq(tables.studentAchievements.organizationId, tournament.organizationId), or(eq(tables.studentAchievements.participantId, participant.id), participant.studentId ? eq(tables.studentAchievements.studentId, participant.studentId) : undefined)) })
  for (const eventType of ['kata', 'kumite'] as const) {
    const entries = existing.filter(entry => entry.eventType === eventType)
    if (!body[eventType]) {
      for (const entry of entries.filter(entry => entry.participantId === participant.id)) await tx.delete(tables.studentAchievements).where(eq(tables.studentAchievements.id, entry.id))
      continue
    }
    const values = {
      organizationId: tournament.organizationId, tournamentId: tournament.id,
      studentId: participant.studentId, participantId: participant.id,
      tournamentName: tournament.name, tournamentLevel: tournament.level, venue: tournament.venue,
      startDate: tournament.startDate, endDate: tournament.endDate,
      eventType, beltDivision: division, ageCategory: participant.ageCategory,
      weightCategory: `${participant.weightKg} kg`,
    }
    if (entries.length) {
      for (const entry of entries) await tx.update(tables.studentAchievements).set(values).where(eq(tables.studentAchievements.id, entry.id))
    } else await tx.insert(tables.studentAchievements).values(values)
  }
}

export async function updateTournamentParticipant(organizationId: number, tournamentId: number, participantId: number, input: unknown) {
  if (!Number.isSafeInteger(participantId) || participantId <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid participant' })
  const parsed = participantSchema.safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(issue => issue.message).join('; ') })
  const body = parsed.data
  return db.transaction(async tx => {
    const [tournament] = await tx.select().from(tables.tournaments).where(and(eq(tables.tournaments.id, tournamentId), eq(tables.tournaments.organizationId, organizationId))).for('update')
    if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
    const previous = await tx.query.tournamentParticipants.findFirst({ where: and(eq(tables.tournamentParticipants.id, participantId), eq(tables.tournamentParticipants.tournamentId, tournamentId), eq(tables.tournamentParticipants.organizationId, organizationId)) })
    if (!previous) throw createError({ statusCode: 404, statusMessage: 'Participant not found' })
    const division = await validatedBeltDivision(tx, organizationId, body.belt, previous)
    validateBirthDate(body.dateOfBirth, tournament.ageCutoffDate || tournament.startDate)
    const identityKey = participantIdentity(body.fullName, body.dateOfBirth)
    const duplicate = await tx.query.tournamentParticipants.findFirst({ where: and(eq(tables.tournamentParticipants.tournamentId, tournamentId), eq(tables.tournamentParticipants.identityKey, identityKey)) })
    if (duplicate && duplicate.id !== participantId) throw createError({ statusCode: 409, statusMessage: 'Another registration already has this name and birth date' })
    const studentId = await matchingStudentId(tx, organizationId, body.fullName, body.dateOfBirth, tournament.dojoIds)
    const [participant] = await tx.update(tables.tournamentParticipants).set({
      fullName: body.fullName, dateOfBirth: body.dateOfBirth, gender: body.gender,
      weightKg: body.weightKg, belt: body.belt, ageCategory: body.ageCategory, identityKey, studentId,
    }).where(and(eq(tables.tournamentParticipants.id, participantId), eq(tables.tournamentParticipants.tournamentId, tournamentId), eq(tables.tournamentParticipants.organizationId, organizationId))).returning()
    if (!participant) throw createError({ statusCode: 404, statusMessage: 'Participant not found' })
    await syncParticipantEntries(tx, tournament, participant, body, division)
    return registrationReceipt(participant)
  })
}

export function createTournamentRegistrationToken() {
  return randomBytes(32).toString('hex')
}
