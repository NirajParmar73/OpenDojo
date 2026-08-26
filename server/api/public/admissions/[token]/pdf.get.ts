import { eq } from 'drizzle-orm'
import { admissionTokenHash } from '../../../../utils/admissions'
import { createAdmissionPdf } from '../../../../utils/admission-pdf'
import { db, tables } from '../../../../utils/database'

export default defineEventHandler(async (event) => {
  const token = String(getRouterParam(event, 'token') || '')
  if (token.length < 32) throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  const application = await db.query.admissionApplications.findFirst({ where: eq(tables.admissionApplications.accessTokenHash, admissionTokenHash(token)), with: { organization: true, dojo: true, program: true } }) as any
  if (!application) throw createError({ statusCode: 404, statusMessage: 'Application not found' })
  const buffer = await createAdmissionPdf(application, application.organization)
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="admission-${application.referenceNumber}.pdf"`, 'Content-Length': String(buffer.length), 'Cache-Control': 'private, no-store' })
  return buffer
})
