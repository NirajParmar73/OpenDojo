import { eventActor, addEventCost } from '../../../../utils/events'
export default defineEventHandler(async event => addEventCost(await eventActor(event), Number(getRouterParam(event, 'id')), await readBody(event)))
