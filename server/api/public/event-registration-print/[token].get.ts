import { eventRegistrationPdf } from '../../../utils/event-registration-pdf'
export default defineEventHandler(async event => {
  const result = await eventRegistrationPdf(getRouterParam(event, 'token') || '')
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="event-registration-${result.reference}.pdf"`, 'Content-Length': String(result.buffer.length), 'Cache-Control': 'private, no-store' })
  return result.buffer
})
