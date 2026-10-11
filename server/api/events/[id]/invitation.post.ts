import { uploadEventInvitation } from '../../../utils/event-invitation'
export default defineEventHandler(event => uploadEventInvitation(event, Number(getRouterParam(event, 'id'))))
