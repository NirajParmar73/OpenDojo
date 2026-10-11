import { eventActor, saveEvent } from '../../utils/events'
export default defineEventHandler(async event => saveEvent(await eventActor(event), await readBody(event)))
