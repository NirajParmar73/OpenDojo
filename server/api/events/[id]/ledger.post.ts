import { eventActor, addEventTransaction } from '../../../utils/events'
export default defineEventHandler(async event => addEventTransaction(await eventActor(event), Number(getRouterParam(event, 'id')), await readBody(event)))
