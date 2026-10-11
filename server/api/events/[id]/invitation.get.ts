import { getEventInvitation } from '../../../utils/event-invitation'
export default defineEventHandler(event => getEventInvitation(event, Number(getRouterParam(event, 'id'))))
