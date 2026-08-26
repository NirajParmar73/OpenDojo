import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmissionApplication } from '../../../utils/admission-access'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'

const schema = z.object({ action: z.enum(['start_review', 'reject', 'save_notes']), internalNotes: z.string().max(4000).optional().nullable(), rejectionReason: z.string().max(2000).optional().nullable() }).refine(value => value.action !== 'reject' || !!value.rejectionReason?.trim(), { message: 'A rejection reason is required', path: ['rejectionReason'] })

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { user, application } = await requireAdmissionApplication(event, id)
  if (application.status === 'approved') throw createError({ statusCode: 409, statusMessage: 'Approved applications cannot be changed' })
  const body = await readValidatedBody(event, schema.parse)
  const now = new Date()
  const values: Partial<typeof tables.admissionApplications.$inferInsert> = { internalNotes: body.internalNotes || null, updatedAt: now }
  if (body.action === 'start_review' && application.status === 'submitted') values.status = 'under_review'
  if (body.action === 'reject') Object.assign(values, { status: 'rejected', rejectionReason: body.rejectionReason!.trim(), reviewedAt: now, reviewedBy: user.id })
  const [updated] = await db.update(tables.admissionApplications).set(values).where(eq(tables.admissionApplications.id, id)).returning()
  await writeAuditLog({ organizationId: user.organizationId!, actorUserId: user.id, action: body.action === 'reject' ? 'admission.rejected' : body.action === 'start_review' ? 'admission.review_started' : 'admission.notes_updated', entityType: 'admission_application', entityId: id, targetLabel: application.referenceNumber, scope: { type: 'dojo', id: application.dojoId }, details: body.action === 'reject' ? body.rejectionReason : null })
  return updated
})
