import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import ExcelJS from 'exceljs'

const require = createRequire(import.meta.url)
function moduleUrl(source) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
}
const sharedUrl = moduleUrl(fs.readFileSync('shared/utils/tournament-participation.ts', 'utf8'))
const { tournamentAge, participantIdentity, beltDivision } = await import(sharedUrl)
const workbookUrl = moduleUrl(fs.readFileSync('server/utils/tournament-workbook.ts', 'utf8')
  .replace('\'exceljs\'', JSON.stringify(pathToFileURL(require.resolve('exceljs')).href))
  .replace('import template from \'../assets/tournament-participation-template.json\'', `const template = ${fs.readFileSync('server/assets/tournament-participation-template.json', 'utf8')}`)
  .replace('\'../../shared/utils/tournament-participation\'', JSON.stringify(sharedUrl)))
const { buildParticipationWorkbook, participationRows } = await import(workbookUrl)
const validationUrl = moduleUrl(fs.readFileSync('server/utils/tournament-validation.ts', 'utf8')
  .replace('\'zod\'', JSON.stringify(pathToFileURL(require.resolve('zod')).href))
  .replace('\'../../shared/utils/tournament-participation\'', JSON.stringify(sharedUrl)))
const { publicParticipantSchema } = await import(validationUrl)
const headings = { name: 'KDF State Championship 2025', participantListTitle: 'Karate-Do Gojukai India, Ahmedabad Participant List', coachName: 'Niraj Parmar', ageCutoffDate: '2025-06-11' }
const player = { name: 'Test Player', kata: true, kumite: true, dateOfBirth: '2017-08-15', weight: '20 kg', belt: 'Green', gender: 'M', category: 'Subjunior', division: 'colour' }
const submission = { fullName: 'Test Player', dateOfBirth: '2017-08-15', weightKg: 20, belt: 'Green', gender: 'M', ageCategory: 'Subjunior', kata: true, kumite: false, consent: true, requestKey: 'a2942896-b587-4e57-9d2a-9f8017015944' }

test('age uses the configured cut-off and UTC birthday boundaries', () => {
  assert.equal(tournamentAge('2017-08-15', '2025-06-11'), 7)
  assert.equal(tournamentAge('2013-06-11', '2025-06-11'), 12)
  assert.equal(tournamentAge('2013-06-12', '2025-06-11'), 11)
  assert.equal(tournamentAge('2013-06-11T23:00:00-01:00', '2025-06-11T23:00:00Z'), 11)
})

test('belt division is derived from the actual belt, including graded brown and black belts', () => {
  for (const belt of ['Brown', 'Black', '1st Dan Black', 'brown belt']) assert.equal(beltDivision(belt), 'brown_black')
  for (const belt of ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple']) assert.equal(beltDivision(belt), 'colour')
})

test('participant identity normalizes spacing and case without merging different birth dates', () => {
  assert.equal(participantIdentity('  Test   PLAYER ', '2017-08-15'), participantIdentity('Test Player', '2017-08-15'))
  assert.notEqual(participantIdentity('Test Player', '2017-08-15'), participantIdentity('Test Player', '2017-08-16'))
})

test('public validation requires complete export data, consent, and at least one event', () => {
  assert.equal(publicParticipantSchema.safeParse(submission).success, true)
  for (const change of [{ kata: false }, { consent: false }, { weightKg: 0 }, { weightKg: '20' }, { weightKg: 301 }, { gender: '' }, { belt: 'Unknown' }, { ageCategory: '' }, { dateOfBirth: '2017-02-30' }, { website: 'spam' }, { requestKey: 'bad' }]) {
    assert.equal(publicParticipantSchema.safeParse({ ...submission, ...change }).success, false, JSON.stringify(change))
  }
})

test('organizer workbook preserves supplied heading rows, columns, merges, widths and one row per player', async () => {
  const workbook = buildParticipationWorkbook(headings, [player], 'colour')
  const bytes = await workbook.xlsx.writeBuffer()
  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(bytes)
  assert.equal(reopened.worksheets.length, 1)
  const sheet = reopened.worksheets[0]
  assert.equal(sheet.getCell('A1').value, headings.name)
  assert.equal(sheet.getCell('A3').value, headings.participantListTitle)
  assert.equal(sheet.getCell('A5').value, 'Coach: Niraj Parmar')
  assert.equal(sheet.getCell('A7').value, 'Color Belts')
  assert.deepEqual(sheet.getRow(8).values.slice(1), ['No', 'Name', 'Kata', 'Kumite', 'DOB', 'Age (as of 11 June 2025)', 'Weight', 'Belt', 'M/F', 'Category'])
  assert.deepEqual(sheet.getRow(9).values.slice(1), [1, 'Test Player', 'Yes', 'Yes', new Date('2017-08-15'), 7, '20 kg', 'Green', 'M', 'Subjunior'])
  assert.equal(sheet.getColumn(2).width, 32)
  assert.equal(sheet.getCell('B5').master.address, 'A5')
  assert.equal(sheet.getCell('C7').master.address, 'A7')
  assert.equal(sheet.getCell('E9').numFmt, 'dd/mm/yyyy')
  assert.equal(sheet.rowCount, 9)
})

test('divisions export separately and together without leaking the other division', () => {
  const rows = [player, { ...player, name: 'Black Belt Player', belt: 'Black', division: 'brown_black', kata: false }]
  const colour = buildParticipationWorkbook(headings, rows, 'colour').worksheets[0]
  const brown = buildParticipationWorkbook(headings, rows, 'brown_black').worksheets[0]
  assert.equal(colour.getCell('B9').value, 'Test Player')
  assert.equal(brown.getCell('A7').value, 'Brown/Black Belts')
  assert.equal(brown.getCell('B9').value, 'Black Belt Player')
  assert.equal(brown.getCell('C9').value, 'No')
  const combined = buildParticipationWorkbook(headings, rows)
  assert.equal(combined.worksheets.length, 2)
  assert.equal(combined.worksheets[0].rowCount, 9)
  assert.equal(combined.worksheets[1].rowCount, 9)
  assert.equal(buildParticipationWorkbook(headings, [], 'colour').worksheets[0].rowCount, 8)
})

test('event entries consolidate into one participant row using submitted profile values', () => {
  const participant = { id: 1, fullName: 'Submitted Name', dateOfBirth: '2017-08-15', weightKg: 20, belt: 'Green', gender: 'M', ageCategory: 'Subjunior' }
  const entry = { studentId: 8, participant, eventType: 'kata', beltDivision: 'colour', student: { firstName: 'Old Name' } }
  const rows = participationRows([entry, { ...entry, eventType: 'kumite' }, { ...entry, participant: { ...participant, id: 2, fullName: 'Unlinked Player' }, studentId: null }])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].name, 'Submitted Name')
  assert.equal(rows[0].kata, true)
  assert.equal(rows[0].kumite, true)
  assert.equal(rows[1].name, 'Unlinked Player')
  assert.equal(rows[1].kumite, false)
})

test('spreadsheet-looking names are literal strings and sample participant data is absent', async () => {
  const workbook = buildParticipationWorkbook(headings, [{ ...player, name: '=HYPERLINK("example.test")' }], 'colour')
  const reopened = new ExcelJS.Workbook()
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer())
  assert.equal(reopened.worksheets[0].getCell('B9').type, ExcelJS.ValueType.String)
  const formatting = fs.readFileSync('server/assets/tournament-participation-template.json', 'utf8')
  assert.equal(formatting.includes('Vedant Parmar'), false)
  assert.equal(formatting.includes('Meghansh Tripathi'), false)
})
