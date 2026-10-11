import { brandedEventInvitation } from '../../../../utils/event-branded-invitation'
import { publicRegistrationEvent } from '../../../../utils/public-event-registration'
export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') || ''
  const camp = await publicRegistrationEvent(event, token)
  return brandedEventInvitation(event, camp.id, token)
})
