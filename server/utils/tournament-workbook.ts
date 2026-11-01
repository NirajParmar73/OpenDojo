import ExcelJS from 'exceljs'
import template from '../assets/tournament-participation-template.json'
import { tournamentAge } from '../../shared/utils/tournament-participation'
import type { tournamentRoster } from './tournament-roster'

export type ParticipationRow = {
  name: string
  kata: boolean
  kumite: boolean
  dateOfBirth: string | Date | null
  weight: string
  belt: string
  gender: string
  category: string
  division: 'colour' | 'brown_black'
}

export type ParticipationHeadings = {
  name: string
  participantListTitle: string
  coachName: string
  ageCutoffDate: string | Date
}

export function participationRows(entries: Awaited<ReturnType<typeof tournamentRoster>>): ParticipationRow[] {
  const grouped = new Map<string, ParticipationRow>()
  for (const entry of entries) {
    const participant = entry.participant
    const key = participant ? `participant-${participant.id}` : `student-${entry.studentId}-${entry.beltDivision}`
    const row = grouped.get(key) || {
      name: participant?.fullName || `${entry.student?.firstName || ''} ${entry.student?.lastName || ''}`.trim(),
      kata: false, kumite: false,
      dateOfBirth: participant?.dateOfBirth || entry.student?.dateOfBirth || null,
      weight: participant ? `${participant.weightKg} kg` : entry.weightCategory || '',
      belt: participant?.belt || entry.student?.currentBeltRank?.name || '',
      gender: participant?.gender || (entry.student?.gender === 'male' ? 'M' : entry.student?.gender === 'female' ? 'F' : ''),
      category: participant?.ageCategory || entry.ageCategory || '',
      division: entry.beltDivision === 'brown_black' ? 'brown_black' as const : 'colour' as const,
    }
    if (entry.eventType === 'kata') row.kata = true
    if (entry.eventType === 'kumite') row.kumite = true
    grouped.set(key, row)
  }
  return [...grouped.values()]
}

export function buildParticipationWorkbook(headings: ParticipationHeadings, participants: ParticipationRow[], division?: 'colour' | 'brown_black') {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'OpenDojos'
  const cutoffLabel = new Date(headings.ageCutoffDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  for (const current of division ? [division] : ['colour', 'brown_black'] as const) {
    const sheet = workbook.addWorksheet(division ? 'Sheet1' : current === 'colour' ? 'Color Belts' : 'Brown Black Belts')
    template.columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width; sheet.getColumn(index + 1).style = structuredClone(template.styles[column.style]) as Partial<ExcelJS.Style> })
    template.rows.forEach((row, index) => {
      if (row.height) sheet.getRow(index + 1).height = row.height
      row.cells.forEach((cell, column) => { sheet.getCell(index + 1, column + 1).style = structuredClone(template.styles[cell.style]) as Partial<ExcelJS.Style> })
    })
    for (const merge of template.merges) sheet.mergeCells(merge)
    sheet.getCell('A1').value = headings.name
    sheet.getCell('A3').value = headings.participantListTitle
    sheet.getCell('A5').value = `Coach: ${headings.coachName}`
    sheet.getCell('A7').value = current === 'colour' ? 'Color Belts' : 'Brown/Black Belts'
    sheet.getRow(8).values = ['No', 'Name', 'Kata', 'Kumite', 'DOB', `Age (as of ${cutoffLabel})`, 'Weight', 'Belt', 'M/F', 'Category']
    const rows = participants.filter(person => person.division === current).sort((a, b) => {
      const ageA = a.dateOfBirth ? tournamentAge(a.dateOfBirth, headings.ageCutoffDate) : Infinity
      const ageB = b.dateOfBirth ? tournamentAge(b.dateOfBirth, headings.ageCutoffDate) : Infinity
      return ageA - ageB || a.name.localeCompare(b.name)
    })
    rows.forEach((person, index) => {
      const row = sheet.getRow(index + 9)
      // Strings remain literal cell values, including names starting with '='.
      row.values = [index + 1, person.name, person.kata ? 'Yes' : 'No', person.kumite ? 'Yes' : 'No', person.dateOfBirth ? new Date(person.dateOfBirth) : '', person.dateOfBirth ? tournamentAge(person.dateOfBirth, headings.ageCutoffDate) : '', person.weight, person.belt, person.gender, person.category]
      template.participantRow.forEach((cell, column) => { row.getCell(column + 1).style = structuredClone(template.styles[cell.style]) as Partial<ExcelJS.Style> })
      row.getCell(5).numFmt = 'dd/mm/yyyy'
    })
    sheet.pageSetup = { ...template.pageSetup, printArea: `A1:J${Math.max(8, rows.length + 8)}`, printTitlesRow: '1:8' } as Partial<ExcelJS.PageSetup>
  }
  return workbook
}
