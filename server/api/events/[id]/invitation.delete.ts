import { removeEventInvitation } from '../../../utils/event-invitation'
export default defineEventHandler(event => removeEventInvitation(event, Number(getRouterParam(event, 'id'))))
