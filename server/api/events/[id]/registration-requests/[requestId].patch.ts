import { eventActor, reviewEventRegistration } from '../../../../utils/events'
export default defineEventHandler(async event => reviewEventRegistration(await eventActor(event), Number(getRouterParam(event, 'id')), Number(getRouterParam(event, 'requestId')), await readBody(event)))
