import { eventActor, createEventBooking } from '../../../../../utils/events'
export default defineEventHandler(async event => createEventBooking(await eventActor(event, true), Number(getRouterParam(event, 'id')), await readBody(event)))
