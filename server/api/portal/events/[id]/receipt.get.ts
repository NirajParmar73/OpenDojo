import { eventReceipt } from '../../../../utils/event-receipt'
export default defineEventHandler(event => eventReceipt(event, true))
