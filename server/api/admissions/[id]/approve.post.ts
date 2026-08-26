import { eq } from 'drizzle-orm'
import { requireAdmissionApplication } from '../../../utils/admission-access'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'
import { enrollStudent } from '../../../services/student-enrollment'
import { getAdmissionForm } from '../../../utils/admissions'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { user, application } = await requireAdmissionApplication(event, id)
  if (application.resultingStudentId || application.status === 'approved') throw createError({ statusCode: 409, statusMessage: 'This application has already been approved' })
  if (application.status === 'rejected') throw createError({ statusCode: 409, statusMessage: 'A rejected application cannot be approved' })
  const form = await getAdmissionForm(user.organizationId!)
  if (form.requirePhysicalCopy && !application.physicalCopyReceivedAt) throw createError({ statusCode: 409, statusMessage: 'Record the physical copy before approving this application' })
  const result = await enrollStudent(user.id, user.organizationId!, {
    dojoId: application.dojoId,
    programId: application.programId,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phone: application.phone,
    dateOfBirth: new Date(application.dateOfBirth).toISOString().slice(0, 10),
    joinedAt: (application.preferredStartDate ? new Date(application.preferredStartDate) : new Date()).toISOString().slice(0, 10),
    gender: application.gender,
    address: application.address,
    city: application.city,
    stateProvince: application.stateProvince,
    country: application.country,
    postalCode: application.postalCode,
    emergencyContact: application.emergencyContact,
    emergencyPhone: application.emergencyPhone,
    medicalNotes: application.medicalNotes,
    status: 'active',
    avatar: application.photoPath,
    autoAssignDefaultFeePlan: false,
    initialDiscount: 0,
    grantPortalAccess: false,
    guardian: application.guardianName && application.guardianRelationship ? { name: application.guardianName, relationship: application.guardianRelationship, phone: application.guardianPhone, email: application.guardianEmail } : undefined,
  })
  const now = new Date()
  const [updated] = await db.update(tables.admissionApplications).set({ status: 'approved', resultingStudentId: result.student.id, reviewedAt: now, reviewedBy: user.id, updatedAt: now }).where(eq(tables.admissionApplications.id, id)).returning()
  await writeAuditLog({ organizationId: user.organizationId!, actorUserId: user.id, action: 'admission.approved', entityType: 'admission_application', entityId: id, targetLabel: application.referenceNumber, scope: { type: 'dojo', id: application.dojoId }, details: `Created student ${result.student.id}; portal access was not granted` })
  return { application: updated, student: result.student }
})
