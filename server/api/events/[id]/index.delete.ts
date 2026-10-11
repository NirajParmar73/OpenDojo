import { deleteUnusedEvent, eventActor } from '../../../utils/events'
export default defineEventHandler(async event => deleteUnusedEvent(await eventActor(event), Number(getRouterParam(event, 'id'))))
