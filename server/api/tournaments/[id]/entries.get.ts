import { tournamentStaff } from '../../../utils/tournament-access'
import { tournamentRoster } from '../../../utils/tournament-roster'

export default defineEventHandler(async event => {
  const user = await tournamentStaff(event)
  return tournamentRoster(user.id, user.organizationId, Number(getRouterParam(event, 'id')))
})
