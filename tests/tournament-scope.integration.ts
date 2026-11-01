import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'

export async function runTournamentScopeChecks(organizationId: number, otherOrganizationId: number, ownerId: number) {
  const { db, tables } = await import('../server/utils/database')
  const access = await import('../server/utils/tournament-access')
  const { canManageTournament } = await import('../shared/utils/tournament-access')
  const { submitTournamentParticipant, createTournamentRegistrationToken } = await import('../server/utils/tournament-registration')
  const { tournamentRoster } = await import('../server/utils/tournament-roster')
  const { buildTournamentReport } = await import('../server/utils/tournament-report')
  const [level] = await db.insert(tables.hierarchyLevels).values({ organizationId, name: 'Test territory', order: 1 }).returning()
  const [root] = await db.insert(tables.hierarchyNodes).values({ organizationId, levelId: level!.id, name: 'Root territory' }).returning()
  const nodes = await db.insert(tables.hierarchyNodes).values(['A', 'B'].map(name => ({ organizationId, levelId: level!.id, parentId: root!.id, name: `Territory ${name}` }))).returning()
  const dojos = await db.insert(tables.dojos).values(nodes.map((node, index) => ({ organizationId, nodeId: node.id, name: `Scope location ${index + 1}` }))).returning()
  const [foreignLevel] = await db.insert(tables.hierarchyLevels).values({ organizationId: otherOrganizationId, name: 'Foreign territory', order: 1 }).returning()
  const [foreignNode] = await db.insert(tables.hierarchyNodes).values({ organizationId: otherOrganizationId, levelId: foreignLevel!.id, name: 'Foreign' }).returning()
  const [foreignDojo] = await db.insert(tables.dojos).values({ organizationId: otherOrganizationId, nodeId: foreignNode!.id, name: 'Foreign location' }).returning()
  const roles = ['country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor'] as const
  let instructorId = 0
  for (const role of roles) {
    const [user] = await db.insert(tables.users).values({ organizationId, role, name: role, email: `${role}@scope.example.test`, passwordHash: 'test-only' }).returning()
    await db.insert(tables.assignments).values({ userId: user!.id, role, scopeType: role === 'instructor' || role === 'dojo_head' ? 'dojo' : 'node', scopeId: role === 'instructor' || role === 'dojo_head' ? dojos[0]!.id : nodes[0]!.id })
    const actor = await access.tournamentActor(user!.id, organizationId)
    assert.equal(actor.manager, true, role)
    assert.deepEqual(access.tournamentCreationScope(actor), [dojos[0]!.id])
    assert.deepEqual(access.tournamentCreationScope(actor, [dojos[0]!.id, dojos[0]!.id]), [dojos[0]!.id])
    assert.throws(() => access.tournamentCreationScope(actor, []), /assigned scope/)
    assert.throws(() => access.tournamentCreationScope(actor, [dojos[1]!.id]), /assigned scope/)
    assert.throws(() => access.tournamentCreationScope(actor, [foreignDojo!.id]), /assigned scope/)
    if (role === 'instructor') instructorId = user!.id
  }
  const [member] = await db.insert(tables.users).values({ organizationId, role: 'member', name: 'Reader', email: 'reader@scope.example.test', passwordHash: 'test-only' }).returning()
  await db.insert(tables.assignments).values({ userId: member!.id, role: 'member', scopeType: 'dojo', scopeId: dojos[0]!.id })
  assert.equal((await access.tournamentActor(member!.id, organizationId)).manager, false)
  const [assignmentManager] = await db.insert(tables.users).values({ organizationId, role: 'member', name: 'Assigned manager', email: 'assigned-manager@scope.example.test', passwordHash: 'test-only' }).returning()
  await db.insert(tables.assignments).values({ userId: assignmentManager!.id, role: 'instructor', scopeType: 'dojo', scopeId: dojos[0]!.id })
  assert.equal((await access.tournamentActor(assignmentManager!.id, organizationId)).manager, true)
  const [unassigned] = await db.insert(tables.users).values({ organizationId, role: 'instructor', name: 'Unassigned', email: 'unassigned@scope.example.test', passwordHash: 'test-only' }).returning()
  assert.equal((await access.tournamentActor(unassigned!.id, organizationId)).manager, false)
  const owner = await access.tournamentActor(ownerId, organizationId)
  assert.deepEqual(access.tournamentCreationScope(owner), [])
  assert.throws(() => access.tournamentCreationScope(owner, [foreignDojo!.id]), /assigned scope/)
  console.log('PASS: all location manager and instructor roles can create in assigned scope; members, unassigned accounts, foreign locations and organization-wide escalation are blocked')

  const token = createTournamentRegistrationToken()
  const [tournament] = await db.insert(tables.tournaments).values({ organizationId, name: 'Scoped instructor tournament', level: 'Club', dojoIds: [dojos[0]!.id], startDate: new Date('2026-12-01'), registrationToken: token }).returning()
  const [outside] = await db.insert(tables.students).values({ organizationId, dojoId: dojos[1]!.id, firstName: 'Outside', lastName: 'Player', dateOfBirth: new Date('2010-01-01'), phone: 'private-outside-scope' }).returning()
  const body = { fullName: 'Outside Player', dateOfBirth: '2010-01-01', weightKg: 40, gender: 'M', belt: 'Green', ageCategory: 'Cadet', kata: true, kumite: false, consent: true, requestKey: randomUUID() }
  await submitTournamentParticipant(tournament!.id, token, body)
  let roster = await tournamentRoster(instructorId, organizationId, tournament!.id)
  assert.equal(roster.length, 1)
  assert.equal(roster[0]!.studentId, null)
  assert.equal(roster[0]!.participant!.fullName, 'Outside Player')
  assert.equal((await buildTournamentReport(instructorId, organizationId, tournament!.id)).summary.competitors, 1)
  assert.equal((await tournamentRoster(member!.id, organizationId, tournament!.id)).length, 0)
  const otherInstructor = await db.insert(tables.users).values({ organizationId, role: 'instructor', name: 'Other instructor', email: 'other-instructor@scope.example.test', passwordHash: 'test-only' }).returning()
  await db.insert(tables.assignments).values({ userId: otherInstructor[0]!.id, role: 'instructor', scopeType: 'dojo', scopeId: dojos[1]!.id })
  const otherActor = await access.tournamentActor(otherInstructor[0]!.id, organizationId)
  await assert.rejects(access.staffTournament(organizationId, tournament!.id, otherActor, true), /not found/)
  await assert.rejects(tournamentRoster(otherInstructor[0]!.id, organizationId, tournament!.id), /not found/)
  console.log('PASS: scoped forms retain public-only participants, matching does not link outside students, and other locations cannot read or manage the form')

  // A linked student can later move location. Keep the submitted participation
  // snapshot visible, without exposing their current private student profile.
  await db.update(tables.studentAchievements).set({ studentId: outside!.id }).where(eq(tables.studentAchievements.id, roster[0]!.id))
  roster = await tournamentRoster(instructorId, organizationId, tournament!.id)
  assert.equal('phone' in roster[0]!.student, false)
  const report = await buildTournamentReport(instructorId, organizationId, tournament!.id)
  assert.equal(report.details[0]!.dojoId, null)
  const [multi] = await db.insert(tables.tournaments).values({ organizationId, name: 'Multi-location', level: 'State', dojoIds: dojos.map(dojo => dojo.id), startDate: new Date('2026-12-01') }).returning()
  const instructor = await access.tournamentActor(instructorId, organizationId)
  assert.equal(canManageTournament(instructor, multi!), false)
  await assert.rejects(access.staffTournament(organizationId, multi!.id, instructor, true), /management scope/)
  await db.delete(tables.assignments).where(eq(tables.assignments.userId, instructorId))
  assert.equal((await access.tournamentActor(instructorId, organizationId)).manager, false)
  await assert.rejects(tournamentRoster(instructorId, organizationId, tournament!.id), /not found/)
  console.log('PASS: current student profiles remain private after moves; partial scopes and revoked assignments cannot manage forms')
}
