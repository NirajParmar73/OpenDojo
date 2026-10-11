import { publicRegistrationForm } from '../../../../utils/public-event-registration'
export default defineEventHandler(event => publicRegistrationForm(event, getRouterParam(event, 'token') || ''))
