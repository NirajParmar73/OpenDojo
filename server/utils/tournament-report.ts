import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from './database'
import { getAccessibleDojoIds } from './permissions'

export const tournamentReportFilterSchema = z.object({
  dojoId: z.coerce.number().int().positive().optional(),
  beltDivision: z.enum(['colour', 'brown_black']).optional(),
  ageCategory: z.string().trim().min(1).max(100).optional(),
  eventType: z.string().trim().min(1).max(100).optional(),
  outcome: z.enum(['gold', 'silver', 'bronze', 'pending', 'did_not_win']).optional(),
})

export type TournamentReportFilters = z.infer<typeof tournamentReportFilterSchema>

function yearsOld(dateOfBirth: Date | null, onDate: Date) {
  if (!dateOfBirth) return null
  let age = onDate.getFullYear() - dateOfBirth.getFullYear()
  const anniversary = new Date(onDate.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate())
  if (anniversary > onDate) age -= 1
  return age
}

type Medal = 'gold' | 'silver' | 'bronze'

function medalFor(record: { placeSecured: number | null, medalType: string | null }): Medal | null {
  if (record.placeSecured === 1) return 'gold'
  if (record.placeSecured === 2) return 'silver'
  if (record.placeSecured === 3 || record.placeSecured === 4) return 'bronze'
  const medal = record.medalType?.trim().toLowerCase()
  return medal === 'gold' || medal === 'silver' || medal === 'bronze' ? medal : null
}

function medalCount(record: { medalType: string | null, medalsWon: number }) {
  return record.medalType?.trim() ? Math.max(record.medalsWon || 0, 1) : record.medalsWon || 0
}

function resultFor(record: { result: string | null, placeSecured: number | null }) {
  const result = record.result?.trim()
  if (result && result.toLowerCase() !== 'pending') return result
  return record.placeSecured === 0 ? 'Did not win' : record.placeSecured === 1 ? '1st place' : record.placeSecured === 2 ? '2nd place' : record.placeSecured === 3 ? '3rd place' : record.placeSecured === 4 ? '4th place' : 'Pending'
}

export async function buildTournamentReport(userId: number, organizationId: number, tournamentId: number, filters: TournamentReportFilters = {}) {
  const tournament = await db.query.tournaments.findFirst({
    where: and(eq(tables.tournaments.id, tournamentId), eq(tables.tournaments.organizationId, organizationId)),
  })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })

  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId) })
  const accessibleDojoIds = await getAccessibleDojoIds(userId, organizationId)
  const records = await db.query.studentAchievements.findMany({
    where: and(eq(tables.studentAchievements.organizationId, organizationId), eq(tables.studentAchievements.tournamentId, tournamentId)),
    with: { student: { with: { dojo: true, program: true } } },
  })
  const visible = records.filter(record => accessibleDojoIds === null || (record.student.dojoId !== null && accessibleDojoIds.includes(record.student.dojoId)))
  if (!visible.length) throw createError({ statusCode: 403, statusMessage: 'This tournament has no entries in your permitted territory' })

  const onDate = tournament.ageCutoffDate || tournament.startDate
  const allDetails = visible.map(record => {
    const medal = medalFor(record)
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: `${record.student.firstName} ${record.student.lastName}`,
      age: yearsOld(record.student.dateOfBirth, onDate),
      dojoId: record.student.dojoId,
      dojoName: record.student.dojo?.name || 'Unassigned dojo',
      programName: record.student.program?.displayName || 'Program not assigned',
      eventType: record.eventType || 'Not set',
      ageCategory: record.ageCategory || 'Not set',
      weightCategory: record.weightCategory || null,
      beltDivision: record.beltDivision === 'brown_black' ? 'brown_black' : 'colour',
      beltDivisionLabel: record.beltDivision === 'brown_black' ? 'Brown / Black' : 'Colour',
      result: resultFor(record),
      placeSecured: record.placeSecured,
      medal,
      medalCount: medal ? medalCount(record) : 0,
    }
  })

  const availableFilters = {
    dojos: [...new Map(allDetails.filter(record => record.dojoId !== null).map(record => [record.dojoId as number, { label: record.dojoName, value: record.dojoId as number }])).values()].sort((a, b) => a.label.localeCompare(b.label)),
    beltDivisions: [...new Map(allDetails.map(record => [record.beltDivision, { label: record.beltDivisionLabel, value: record.beltDivision }])).values()].sort((a, b) => a.label.localeCompare(b.label)),
    ageCategories: [...new Set(allDetails.map(record => record.ageCategory))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    eventTypes: [...new Set(allDetails.map(record => record.eventType))].sort((a, b) => a.localeCompare(b)),
  }
  const details = allDetails.filter(record => {
    if (filters.dojoId !== undefined && record.dojoId !== filters.dojoId) return false
    if (filters.beltDivision && record.beltDivision !== filters.beltDivision) return false
    if (filters.ageCategory && record.ageCategory !== filters.ageCategory) return false
    if (filters.eventType && record.eventType !== filters.eventType) return false
    if (filters.outcome === 'gold' || filters.outcome === 'silver' || filters.outcome === 'bronze') return record.medal === filters.outcome
    if (filters.outcome === 'pending') return !record.medal && record.placeSecured === null
    if (filters.outcome === 'did_not_win') return !record.medal && record.placeSecured === 0
    return true
  })

  const appliedFilterLabels = [
    filters.dojoId !== undefined ? `Dojo: ${availableFilters.dojos.find(dojo => dojo.value === filters.dojoId)?.label || `#${filters.dojoId}`}` : null,
    filters.beltDivision ? `Belt: ${availableFilters.beltDivisions.find(division => division.value === filters.beltDivision)?.label}` : null,
    filters.ageCategory ? `Age: ${filters.ageCategory}` : null,
    filters.eventType ? `Event: ${filters.eventType}` : null,
    filters.outcome ? `Outcome: ${({ gold: 'Gold', silver: 'Silver', bronze: 'Bronze', pending: 'Pending', did_not_win: 'Did not win' } as const)[filters.outcome]}` : null,
  ].filter((label): label is string => Boolean(label))

  const summary = {
    competitors: new Set(details.map(record => record.studentId)).size,
    entries: details.length,
    medalists: new Set(details.filter(record => record.medal).map(record => record.studentId)).size,
    pending: details.filter(record => record.placeSecured === null).length,
    didNotWin: details.filter(record => record.placeSecured === 0).length,
    gold: 0,
    silver: 0,
    bronze: 0,
    totalMedals: 0,
  }
  for (const record of details) if (record.medal) {
    summary[record.medal] += record.medalCount
    summary.totalMedals += record.medalCount
  }

  const categoryMap = new Map<string, { beltDivision: string, beltDivisionLabel: string, ageCategory: string, eventType: string, entries: number, competitors: Set<number>, gold: number, silver: number, bronze: number }>()
  const dojoMap = new Map<string, { dojoName: string, entries: number, competitors: Set<number>, gold: number, silver: number, bronze: number, winningEntries: number }>()
  for (const record of details) {
    const categoryKey = `${record.beltDivision}|${record.ageCategory}|${record.eventType}`
    const category = categoryMap.get(categoryKey) || { beltDivision: record.beltDivision, beltDivisionLabel: record.beltDivisionLabel, ageCategory: record.ageCategory, eventType: record.eventType, entries: 0, competitors: new Set<number>(), gold: 0, silver: 0, bronze: 0 }
    category.entries += 1
    category.competitors.add(record.studentId)
    if (record.medal) category[record.medal] += record.medalCount
    categoryMap.set(categoryKey, category)

    const dojo = dojoMap.get(record.dojoName) || { dojoName: record.dojoName, entries: 0, competitors: new Set<number>(), gold: 0, silver: 0, bronze: 0, winningEntries: 0 }
    dojo.entries += 1
    dojo.competitors.add(record.studentId)
    if (record.medal) {
      dojo[record.medal] += record.medalCount
      dojo.winningEntries += 1
    }
    dojoMap.set(record.dojoName, dojo)
  }

  const categories = [...categoryMap.values()].map(({ competitors, ...category }) => ({ ...category, competitors: competitors.size, totalMedals: category.gold + category.silver + category.bronze }))
    .sort((a, b) => a.beltDivision.localeCompare(b.beltDivision) || a.ageCategory.localeCompare(b.ageCategory, undefined, { numeric: true }) || a.eventType.localeCompare(b.eventType))
  const dojos = [...dojoMap.values()].map(({ competitors, ...dojo }) => ({
    ...dojo,
    competitors: competitors.size,
    totalMedals: dojo.gold + dojo.silver + dojo.bronze,
    points: dojo.gold * 3 + dojo.silver * 2 + dojo.bronze,
    medalRate: dojo.entries ? Math.round((dojo.winningEntries / dojo.entries) * 1000) / 10 : 0,
  })).sort((a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || a.dojoName.localeCompare(b.dojoName))
  const winners = details.filter(record => record.medal).sort((a, b) => a.beltDivision.localeCompare(b.beltDivision) || a.ageCategory.localeCompare(b.ageCategory, undefined, { numeric: true }) || a.eventType.localeCompare(b.eventType) || (a.placeSecured || 99) - (b.placeSecured || 99) || a.studentName.localeCompare(b.studentName))

  return { organization, tournament, summary, categories, dojos, winners, details, availableFilters, appliedFilters: filters, appliedFilterLabels }
}
