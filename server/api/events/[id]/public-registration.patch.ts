import { eventActor, setPublicEventRegistration } from '../../../utils/events'
export default defineEventHandler(async event => setPublicEventRegistration(await eventActor(event), Number(getRouterParam(event, 'id')), await readBody(event)))
