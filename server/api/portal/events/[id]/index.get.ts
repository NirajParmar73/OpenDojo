import { eventActor, getEventDetail } from '../../../../utils/events'
export default defineEventHandler(async event => getEventDetail(await eventActor(event, true), Number(getRouterParam(event, 'id'))))
