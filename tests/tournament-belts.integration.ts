import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'

export async function runTournamentBeltChecks(organizationId: number, otherOrganizationId: number, ownerId: number) {
  const { db, tables } = await import('../server/utils/database')
  const { tournamentBelts } = await import('../server/utils/tournament-belts')
  const { submitTournamentParticipant, updateTournamentParticipant, createTournamentRegistrationToken } = await import('../server/utils/tournament-registration')
  const { tournamentRoster } = await import('../server/utils/tournament-roster')
  const { participationRows, buildParticipationWorkbook } = await import('../server/utils/tournament-workbook')
  assert.deepEqual(await tournamentBelts(otherOrganizationId), [])
  const [system] = await db.insert(tables.beltSystems).values({ organizationId, name: 'Additional custom belt system' }).returning()
  const [foreignSystem] = await db.insert(tables.beltSystems).values({ organizationId: otherOrganizationId, name: 'Foreign belt system' }).returning()
  const ranks = await db.insert(tables.beltRanks).values([
    { systemId: system!.id, name: 'Shodan', level: 'shodan', order: 2, type: 'dan', color: null },
    { systemId: system!.id, name: 'Striped Orange', level: 'striped_orange', order: 1, type: 'kyu', color: 'orange' },
    { systemId: system!.id, name: '3rd Kyu', level: 'third_kyu', order: 3, type: 'kyu', color: '#A52A2A' },
    { systemId: foreignSystem!.id, name: 'Foreign Only', level: 'foreign', order: 1, type: 'kyu', color: 'purple' },
  ]).returning()
  const options = await tournamentBelts(organizationId)
  assert.deepEqual(options.map(option => option.value), ['Green', 'Brown', 'Black', 'Striped Orange', 'Shodan', '3rd Kyu'])
  assert.equal(options.find(option => option.value === 'Shodan')!.division, 'brown_black')
  assert.equal(options.find(option => option.value === '3rd Kyu')!.division, 'brown_black')
  assert.equal(options.some(option => option.value === 'Foreign Only'), false)
  const token = createTournamentRegistrationToken()
  const [tournament] = await db.insert(tables.tournaments).values({ organizationId, name: 'Custom belts tournament', level: 'Club', startDate: new Date('2026-12-01'), registrationToken: token }).returning()
  const body = { fullName: 'Custom Belt Player', dateOfBirth: '2010-01-01', weightKg: 40, gender: 'M', belt: 'Shodan', ageCategory: 'Cadet', kata: true, kumite: false, consent: true, requestKey: randomUUID() }
  const receipt = await submitTournamentParticipant(tournament!.id, token, body)
  await submitTournamentParticipant(tournament!.id, token, { ...body, fullName: 'Colour Belt Player', belt: 'Striped Orange', requestKey: randomUUID() })
  for (const belt of ['Foreign Only', 'Yellow', 'Unknown']) await assert.rejects(submitTournamentParticipant(tournament!.id, token, { ...body, fullName: 'Rejected Player', belt, requestKey: randomUUID() }), /current belt system/)
  let roster = await tournamentRoster(ownerId, organizationId, tournament!.id)
  const player = roster.find(entry => entry.participant?.belt === 'Shodan')!
  assert.equal(player.beltDivision, 'brown_black')
  const workbook = buildParticipationWorkbook({ ...tournament!, ageCutoffDate: tournament!.startDate }, participationRows(roster))
  assert.equal(workbook.worksheets[0]!.getCell('H9').value, 'Striped Orange')
  assert.equal(workbook.worksheets[1]!.getCell('H9').value, 'Shodan')
  await db.delete(tables.beltRanks).where(eq(tables.beltRanks.id, ranks[0]!.id))
  assert.equal((await tournamentBelts(organizationId)).some(option => option.value === 'Shodan'), false)
  assert.deepEqual(await submitTournamentParticipant(tournament!.id, token, body), receipt)
  await updateTournamentParticipant(organizationId, tournament!.id, player.participantId!, { ...body, weightKg: 42 })
  roster = await tournamentRoster(ownerId, organizationId, tournament!.id)
  assert.equal(roster.find(entry => entry.id === player.id)!.beltDivision, 'brown_black')
  assert.equal(roster.find(entry => entry.id === player.id)!.participant!.belt, 'Shodan')
  await assert.rejects(submitTournamentParticipant(tournament!.id, token, { ...body, fullName: 'New Shodan Player', requestKey: randomUUID() }), /current belt system/)
  await assert.rejects(updateTournamentParticipant(organizationId, tournament!.id, player.participantId!, { ...body, belt: 'Foreign Only' }), /current belt system/)
  console.log('PASS: configured belts from all organization systems, rank ordering, foreign/unknown belt rejection, custom Dan and brown divisions, exact exported names and editable historical ranks')
}
