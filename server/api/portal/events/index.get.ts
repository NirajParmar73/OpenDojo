import { eventActor, listEvents } from '../../../utils/events'
export default defineEventHandler(async event => listEvents(await eventActor(event, true)))
