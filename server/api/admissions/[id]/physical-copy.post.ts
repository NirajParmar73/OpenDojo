import { eq } from 'drizzle-orm'
import { requireAdmissionApplication } from '../../../utils/admission-access'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { user, application } = await requireAdmissionApplication(event, id)
  if (['approved', 'rejected'].includes(application.status)) throw createError({ statusCode: 409, statusMessage: 'This application is already finalized' })
  const now = new Date()
  const [updated] = await db.update(tables.admissionApplications).set({ status: 'physical_received', physicalCopyReceivedAt: now, physicalCopyReceivedBy: user.id, updatedAt: now }).where(eq(tables.admissionApplications.id, id)).returning()
  await writeAuditLog({ organizationId: user.organizationId!, actorUserId: user.id, action: 'admission.physical_copy_received', entityType: 'admission_application', entityId: id, targetLabel: application.referenceNumber, scope: { type: 'dojo', id: application.dojoId } })
  return updated
})
