// Run with: bun run tests/tournaments.integration.ts
// All migrations and records are confined to a uniquely named disposable LOCAL database.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { and, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'

const applicationUrl = new URL(process.env.DATABASE_URL || '')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(applicationUrl.hostname), 'Integration tests require a local PostgreSQL server')
const testName = `opendojo_tournaments_test_${randomUUID().replaceAll('-', '')}`
assert.match(testName, /^opendojo_tournaments_test_[a-f0-9]{32}$/)
const admin = postgres(applicationUrl.toString(), { max: 1, onnotice: () => {} })
let created = false
let connection: ReturnType<typeof postgres> | undefined
try {
  await admin.unsafe(`CREATE DATABASE "${testName}"`)
  created = true
  const testUrl = new URL(applicationUrl)
  testUrl.pathname = `/${testName}`
  process.env.DATABASE_URL = testUrl.toString()
  connection = postgres(testUrl.toString(), { max: 1, onnotice: () => {} })
  await migrate(drizzle(connection), { migrationsFolder: 'server/database/drizzle-postgres' })
  console.log('PASS: all migrations apply to a clean PostgreSQL database')
  Object.assign(globalThis, { createError: (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input) })
  const { db, tables } = await import('../server/utils/database')
  const service = await import('../server/utils/tournament-registration')
  const access = await import('../server/utils/tournament-access')
  const { tournamentRoster } = await import('../server/utils/tournament-roster')
  const { buildTournamentReport } = await import('../server/utils/tournament-report')
  const { buildParticipationWorkbook, participationRows } = await import('../server/utils/tournament-workbook')
  const [org] = await db.insert(tables.organizations).values({ name: 'Karate-Do Gojukai India, Ahmedabad', slug: 'tournament-test' }).returning()
  const [otherOrg] = await db.insert(tables.organizations).values({ name: 'Other tenant', slug: 'other-tournament-test' }).returning()
  const [owner] = await db.insert(tables.users).values({ name: 'Owner', email: 'owner@example.test', passwordHash: 'test-only', organizationId: org!.id, role: 'owner' }).returning()
  const [instructor] = await db.insert(tables.users).values({ name: 'Instructor', email: 'instructor@example.test', passwordHash: 'test-only', organizationId: org!.id, role: 'instructor' }).returning()
  const [student] = await db.insert(tables.students).values({ organizationId: org!.id, firstName: 'Linked', lastName: 'Player', dateOfBirth: new Date('2017-08-15'), gender: 'male' }).returning()
  await db.insert(tables.students).values({ organizationId: otherOrg!.id, firstName: 'Linked', lastName: 'Player', dateOfBirth: new Date('2017-08-15') })
  const token = service.createTournamentRegistrationToken()
  assert.match(token, /^[a-f0-9]{64}$/)
  const [tournament] = await db.insert(tables.tournaments).values({ organizationId: org!.id, name: 'KDF State Championship 2025', level: 'State', startDate: new Date('2025-06-15'), ageCutoffDate: new Date('2025-06-11'), participantListTitle: `${org!.name} Participant List`, coachName: 'Niraj Parmar', registrationToken: token }).returning()
  const http = { context: {} } as any
  assert.equal((await access.publicTournament(http, token)).id, tournament!.id)
  await assert.rejects(access.publicTournament({ context: { tenant: { id: otherOrg!.id } } } as any, token), /unavailable/)
  await assert.rejects(access.publicTournament(http, 'bad-token'), /unavailable/)
  await assert.rejects(access.staffTournament(otherOrg!.id, tournament!.id), /not found/)
  Object.assign(globalThis, { getUserSession: async () => ({ user: { ...instructor! } }) })
  await assert.rejects(access.tournamentStaff(http, true), /administrators/)
  Object.assign(globalThis, { getUserSession: async () => ({ user: { ...owner! } }) })
  assert.equal((await access.tournamentStaff(http, true)).id, owner!.id)
  console.log('PASS: share token, tenant isolation and administrator permissions')

  const [manual] = await db.insert(tables.studentAchievements).values({ organizationId: org!.id, studentId: student!.id, tournamentId: tournament!.id, tournamentName: tournament!.name, tournamentLevel: tournament!.level, startDate: tournament!.startDate, eventType: 'kata', placeSecured: 1, medalType: 'gold', medalsWon: 1 }).returning()
  const body = { fullName: '  Linked   Player ', dateOfBirth: '2017-08-15', weightKg: 20, belt: 'Green', gender: 'M', ageCategory: 'Subjunior', kata: true, kumite: true, requestKey: randomUUID(), consent: true }
  const receipt = await service.submitTournamentParticipant(tournament!.id, token, body)
  assert.match(receipt.reference, /^TP-\d{6}$/)
  assert.deepEqual(await service.submitTournamentParticipant(tournament!.id, token, body), receipt)
  await assert.rejects(service.submitTournamentParticipant(tournament!.id, token, { ...body, requestKey: randomUUID() }), /already exists/)
  await assert.rejects(service.submitTournamentParticipant(tournament!.id, token, { ...body, fullName: 'Bad date', dateOfBirth: '2099-01-01', requestKey: randomUUID() }), /birth date/)
  await assert.rejects(service.submitTournamentParticipant(tournament!.id, token, { ...body, fullName: 'No events', kata: false, kumite: false, requestKey: randomUUID() }), /Select Kata/)
  let roster = await tournamentRoster(owner!.id, org!.id, tournament!.id)
  assert.equal(roster.length, 2)
  assert.ok(roster.every(entry => entry.studentId === student!.id && entry.participant?.fullName === 'Linked Player'))
  assert.equal(roster.find(entry => entry.id === manual!.id)!.placeSecured, 1)
  assert.equal(roster.find(entry => entry.eventType === 'kumite')!.placeSecured, null)
  assert.equal((await db.select().from(tables.students)).length, 2)
  console.log('PASS: linked registration, both events, pending results, safe retries, duplicate validation and existing result preservation')

  const external = { ...body, fullName: 'External Player', dateOfBirth: '2010-06-11', gender: 'F', belt: 'Black', weightKg: 52.5, kata: false, ageCategory: 'Cadet', requestKey: randomUUID() }
  await service.submitTournamentParticipant(tournament!.id, token, external)
  const parallel = await Promise.allSettled([1, 2].map(() => service.submitTournamentParticipant(tournament!.id, token, { ...external, fullName: 'Concurrent Player', requestKey: randomUUID() })))
  assert.equal(parallel.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(parallel.filter(result => result.status === 'rejected').length, 1)
  roster = await tournamentRoster(owner!.id, org!.id, tournament!.id)
  const unlinked = roster.find(entry => entry.participant?.fullName === external.fullName)!
  assert.equal(unlinked.studentId, null)
  assert.equal(unlinked.beltDivision, 'brown_black')
  assert.equal(unlinked.student.firstName, external.fullName)
  assert.equal((await tournamentRoster(instructor!.id, org!.id, tournament!.id)).length, 0)
  console.log('PASS: public-only participants, automatic division, concurrent duplicates and territory restrictions')

  const participantId = roster.find(entry => entry.studentId === student!.id)!.participantId!
  await service.updateTournamentParticipant(org!.id, tournament!.id, participantId, { ...body, weightKg: 21, belt: 'Brown' })
  roster = await tournamentRoster(owner!.id, org!.id, tournament!.id)
  assert.ok(roster.filter(entry => entry.studentId === student!.id).every(entry => entry.beltDivision === 'brown_black' && entry.weightCategory === '21 kg'))
  assert.equal(roster.find(entry => entry.id === manual!.id)!.placeSecured, 1)
  await service.updateTournamentParticipant(org!.id, tournament!.id, participantId, { ...body, weightKg: 21, belt: 'Green', kumite: false })
  roster = await tournamentRoster(owner!.id, org!.id, tournament!.id)
  assert.equal(roster.filter(entry => entry.studentId === student!.id).length, 1)
  const report = await buildTournamentReport(owner!.id, org!.id, tournament!.id)
  assert.equal(report.summary.competitors, 3)
  assert.equal(report.summary.entries, 3)
  assert.equal(report.summary.gold, 1)
  assert.equal(report.summary.pending, 2)
  console.log('PASS: profile corrections synchronize divisions and event selection without losing retained results; reports count unlinked players separately')

  const rows = participationRows(roster)
  assert.equal(rows.length, 3)
  const workbook = buildParticipationWorkbook({ ...tournament!, ageCutoffDate: tournament!.ageCutoffDate! }, rows)
  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer())
  assert.equal(reopened.worksheets[0]!.getCell('B9').value, 'Linked Player')
  assert.equal(reopened.worksheets[0]!.getCell('F9').value, 7)
  assert.equal(reopened.worksheets[0]!.getCell('D9').value, 'No')
  assert.equal(reopened.worksheets[1]!.rowCount, 10)
  assert.equal(buildParticipationWorkbook({ ...tournament!, ageCutoffDate: tournament!.ageCutoffDate! }, rows, 'colour').worksheets.length, 1)
  console.log('PASS: database submissions export to the exact heading layout in two categorized sheets')

  await db.update(tables.tournaments).set({ registrationEnabled: false }).where(eq(tables.tournaments.id, tournament!.id))
  await assert.rejects(service.submitTournamentParticipant(tournament!.id, token, { ...body, fullName: 'Late Player', requestKey: randomUUID() }), /closed/)
  assert.deepEqual(await service.submitTournamentParticipant(tournament!.id, token, body), receipt)
  await service.updateTournamentParticipant(org!.id, tournament!.id, participantId, { ...body, weightKg: 22 })
  await db.update(tables.tournaments).set({ registrationEnabled: true }).where(eq(tables.tournaments.id, tournament!.id))
  await service.submitTournamentParticipant(tournament!.id, token, { ...external, fullName: 'Reopened Player', requestKey: randomUUID() })
  const [deleted] = await db.delete(tables.tournamentParticipants).where(and(eq(tables.tournamentParticipants.id, unlinked.participantId!), eq(tables.tournamentParticipants.organizationId, org!.id))).returning()
  assert.ok(deleted)
  assert.equal((await db.select().from(tables.studentAchievements).where(eq(tables.studentAchievements.participantId, unlinked.participantId!))).length, 0)
  console.log('PASS: close/reopen registration, closed-form idempotent retry, admin corrections and participant removal')
  if (process.env.TOURNAMENT_HTTP_TEST === '1') {
    const { runTournamentHttpChecks } = await import('./tournament-http')
    await runTournamentHttpChecks(testUrl.toString(), org!.id, owner!.id, instructor!.id)
  }
  await db.update(tables.organizations).set({ subscriptionStatus: 'suspended' }).where(eq(tables.organizations.id, org!.id))
  await assert.rejects(access.publicTournament(http, token), /unavailable/)
  console.log('PASS: suspended organizations cannot accept public participation')
} finally {
  if (connection) await connection.end()
  if (created) {
    await admin`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${testName} AND pid <> pg_backend_pid()`
    await admin.unsafe(`DROP DATABASE "${testName}"`)
  }
  await admin.end()
}
