import { eventActor, updateEventBooking } from '../../../../utils/events'
export default defineEventHandler(async event => updateEventBooking(await eventActor(event), Number(getRouterParam(event, 'id')), Number(getRouterParam(event, 'bookingId')), await readBody(event)))
