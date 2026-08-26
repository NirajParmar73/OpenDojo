import { requireAdmissionApplication } from '../../../utils/admission-access'
import { createAdmissionPdf } from '../../../utils/admission-pdf'

export default defineEventHandler(async (event) => {
  const { application } = await requireAdmissionApplication(event, Number(getRouterParam(event, 'id')))
  const buffer = await createAdmissionPdf(application, application.organization)
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="admission-${application.referenceNumber}.pdf"`, 'Content-Length': String(buffer.length), 'Cache-Control': 'private, no-store' })
  return buffer
})
