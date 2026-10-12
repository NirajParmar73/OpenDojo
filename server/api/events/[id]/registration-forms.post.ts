import { eventActor } from '../../../utils/events'
import { saveRegistrationForm } from '../../../utils/event-registration-forms'

export default defineEventHandler(async event => saveRegistrationForm(await eventActor(event), Number(getRouterParam(event, 'id')), await readBody(event)))
