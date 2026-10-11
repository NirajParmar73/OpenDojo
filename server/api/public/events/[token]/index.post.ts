import { submitPublicEventRegistration } from '../../../../utils/public-event-registration'
export default defineEventHandler(async event => {
  const token = getRouterParam(event, 'token') || ''
  if (!getHeader(event, 'content-type')?.toLowerCase().startsWith('multipart/form-data')) return submitPublicEventRegistration(event, token, await readBody(event))
  const parts = await readMultipartFormData(event)
  const registration = parts?.find(part => part.name === 'registration' && !part.filename)
  if (!registration) throw createError({ statusCode: 400, statusMessage: 'Registration details are missing' })
  let body: unknown
  try { body = JSON.parse(registration.data.toString('utf8')) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid registration details' }) }
  const file = parts?.find(part => part.name === 'photo' && part.filename)
  return submitPublicEventRegistration(event, token, body, file ? { data: file.data, type: file.type } : undefined)
})
