import { getEventInvitation } from '../../../../utils/event-invitation'
import { publicRegistrationEvent } from '../../../../utils/public-event-registration'
export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') || ''
  const camp = await publicRegistrationEvent(event, token)
  return getEventInvitation(event, camp.id, token)
})
