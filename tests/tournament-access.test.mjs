import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const js = ts.transpileModule(fs.readFileSync('shared/utils/tournament-access.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { tournamentManagerRoles, canManageTournament, canViewTournament, canViewTournamentEntry } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const owner = { manager: true, dojoIds: null }
const manager = { manager: true, dojoIds: [1, 2] }
const instructor = { manager: true, dojoIds: [1] }

test('location manager and instructor roles are eligible for tournament form management', () => {
  for (const role of ['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head', 'instructor']) assert.ok(tournamentManagerRoles.includes(role), role)
  for (const role of ['member', 'student']) assert.equal(tournamentManagerRoles.includes(role), false)
})

test('organization owners and admins retain organization-wide and scoped management', () => {
  assert.equal(canManageTournament(owner, { dojoIds: [] }), true)
  assert.equal(canManageTournament(owner, { dojoIds: [1, 3] }), true)
  assert.equal(canViewTournament(owner, { dojoIds: [3] }), true)
})

test('managers can manage forms only when all participating locations are assigned to them', () => {
  for (const dojoIds of [[1], [2], [1, 2]]) assert.equal(canManageTournament(manager, { dojoIds }), true)
  for (const dojoIds of [[], [3], [1, 3]]) assert.equal(canManageTournament(manager, { dojoIds }), false)
  assert.equal(canManageTournament(instructor, { dojoIds: [1] }), true)
  assert.equal(canManageTournament(instructor, { dojoIds: [1, 2] }), false)
})

test('partial location access allows scoped results without granting form management', () => {
  assert.equal(canViewTournament(instructor, { dojoIds: [1, 3] }), true)
  assert.equal(canViewTournament(instructor, { dojoIds: [3] }), false)
  assert.equal(canViewTournament(instructor, { dojoIds: [] }), true)
  assert.equal(canManageTournament(instructor, { dojoIds: [1, 3] }), false)
})

test('unlinked players are visible to managers of their scoped form and organization admins', () => {
  const player = { participantId: 4, student: null }
  assert.equal(canViewTournamentEntry(instructor, { dojoIds: [1] }, player), true)
  assert.equal(canViewTournamentEntry(instructor, { dojoIds: [] }, player), false)
  assert.equal(canViewTournamentEntry(instructor, { dojoIds: [1, 3] }, player), false)
  assert.equal(canViewTournamentEntry(owner, { dojoIds: [] }, player), true)
})

test('read-only staff and partial managers see only linked entries in their locations', () => {
  const reader = { manager: false, dojoIds: [1] }
  const inside = { participantId: 4, student: { dojoId: 1 } }
  const outside = { participantId: 5, student: { dojoId: 3 } }
  const guest = { participantId: 6, student: null }
  for (const actor of [reader, instructor]) {
    assert.equal(canViewTournamentEntry(actor, { dojoIds: [1, 3] }, inside), true)
    assert.equal(canViewTournamentEntry(actor, { dojoIds: [1, 3] }, outside), false)
    assert.equal(canViewTournamentEntry(actor, { dojoIds: [1, 3] }, guest), false)
  }
})

test('accounts without assigned locations cannot manage forms or read participants', () => {
  const unassigned = { manager: false, dojoIds: [] }
  assert.equal(canManageTournament(unassigned, { dojoIds: [] }), false)
  assert.equal(canManageTournament(unassigned, { dojoIds: [1] }), false)
  assert.equal(canViewTournamentEntry(unassigned, { dojoIds: [] }, { participantId: 1, student: { dojoId: 1 } }), false)
})
