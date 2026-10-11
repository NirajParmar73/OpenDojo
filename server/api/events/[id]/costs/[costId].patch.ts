import { eventActor, updateEventCost } from '../../../../utils/events'
export default defineEventHandler(async event => updateEventCost(await eventActor(event), Number(getRouterParam(event, 'id')), Number(getRouterParam(event, 'costId')), await readBody(event)))
