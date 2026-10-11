import { brandedEventInvitation } from '../../../utils/event-branded-invitation'
export default defineEventHandler(event => brandedEventInvitation(event, Number(getRouterParam(event, 'id'))))
