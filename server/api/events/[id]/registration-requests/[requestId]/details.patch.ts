import { correctEventRegistration, eventActor } from '../../../../../utils/events'
export default defineEventHandler(async event => correctEventRegistration(await eventActor(event), Number(getRouterParam(event, 'id')), Number(getRouterParam(event, 'requestId')), await readBody(event)))
