import { z } from 'zod'
import { staffTournament, tournamentStaff } from '../../../utils/tournament-access'
import { tournamentRoster } from '../../../utils/tournament-roster'
import { buildParticipationWorkbook, participationRows } from '../../../utils/tournament-workbook'

export default defineEventHandler(async event => {
  const user = await tournamentStaff(event, true)
  const id = Number(getRouterParam(event, 'id'))
  const tournament = await staffTournament(user.organizationId, id, user)
  const { division } = await getValidatedQuery(event, z.object({ division: z.enum(['colour', 'brown_black']).optional() }).parse)
  const entries = await tournamentRoster(user.id, user.organizationId, id)
  const workbook = buildParticipationWorkbook({ ...tournament, ageCutoffDate: tournament.ageCutoffDate || tournament.startDate }, participationRows(entries), division)
  const filename = `${tournament.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100) || 'Tournament'}-${division === 'colour' ? 'Color-Belts' : division === 'brown_black' ? 'Brown-Black-Belts' : 'Participation-Lists'}.xlsx`
  setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return Buffer.from(await workbook.xlsx.writeBuffer())
})
