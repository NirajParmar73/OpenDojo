import { eventActor, markEventPhysicalCopy } from '../../../../../utils/events'
export default defineEventHandler(async event => markEventPhysicalCopy(await eventActor(event), Number(getRouterParam(event, 'id')), Number(getRouterParam(event, 'requestId'))))
