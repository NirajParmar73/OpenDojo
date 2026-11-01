import { tournamentStaff } from '../../utils/tournament-access'
import { tournamentBelts } from '../../utils/tournament-belts'

export default defineEventHandler(async event => {
  const actor = await tournamentStaff(event)
  return { canCreate: actor.manager, organizationWide: actor.dojoIds === null, defaultDojoIds: actor.dojoIds || [], dojoOptions: actor.locations.map(location => ({ label: location.name, value: location.id })), beltOptions: await tournamentBelts(actor.organizationId) }
})
