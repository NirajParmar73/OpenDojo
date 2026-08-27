import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmissionApplication } from '../../../utils/admission-access'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'
import { enrollStudent } from '../../../services/student-enrollment'
import { getAdmissionForm } from '../../../utils/admissions'
import { generateTemporaryPassword, studentPortalUsername, type PortalCredentials } from '../../../utils/student-portal'
import { isDojoAccessible, isDojoWithinHierarchyNode } from '../../../utils/permissions'

const existingApprovalSchema = z.object({ matchedStudentId: z.number().int().positive().nullable().optional(), feePlanId: z.number().int().positive().nullable().optional(), feeStartDate: z.string().date().optional(), grantPortalAccess: z.boolean().default(true) })
  .refine(body => !body.feePlanId || !!body.feeStartDate, { message: 'Choose when fee tracking should begin', path: ['feeStartDate'] })

async function createPortalAccount(student: { id: number, firstName: string, lastName: string }): Promise<PortalCredentials | null> {
  const existing = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.studentId, student.id) })
  if (existing) return null
  const temporaryPassword = generateTemporaryPassword()
  const username = studentPortalUsername(student.firstName, student.lastName, student.id)
  await db.insert(tables.studentPortalAccounts).values({ studentId: student.id, username, passwordHash: await hashPassword(temporaryPassword), isActive: 1, mustChangePassword: true })
  return { studentId: student.id, studentName: `${student.firstName} ${student.lastName}`, username, temporaryPassword }
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { user, application } = await requireAdmissionApplication(event, id)
  if (application.resultingStudentId || application.status === 'approved') throw createError({ statusCode: 409, statusMessage: 'This application has already been approved' })
  if (application.status === 'rejected') throw createError({ statusCode: 409, statusMessage: 'A rejected application cannot be approved' })
  const form = await getAdmissionForm(user.organizationId!)

  if (application.applicationType !== 'existing') {
    if (form.requirePhysicalCopy && !application.physicalCopyReceivedAt) throw createError({ statusCode: 409, statusMessage: 'Record the physical copy before approving this application' })
    const result = await enrollStudent(user.id, user.organizationId!, {
      dojoId: application.dojoId, programId: application.programId, firstName: application.firstName, lastName: application.lastName,
      email: application.email, phone: application.phone, dateOfBirth: new Date(application.dateOfBirth).toISOString().slice(0, 10), joinedAt: (application.preferredStartDate ? new Date(application.preferredStartDate) : new Date()).toISOString().slice(0, 10),
      gender: application.gender, address: application.address, city: application.city, stateProvince: application.stateProvince, country: application.country, postalCode: application.postalCode,
      emergencyContact: application.emergencyContact, emergencyPhone: application.emergencyPhone, medicalNotes: application.medicalNotes, status: 'active', avatar: application.photoPath,
      autoAssignDefaultFeePlan: false, initialDiscount: 0, grantPortalAccess: false,
      guardian: application.guardianName && application.guardianRelationship ? { name: application.guardianName, relationship: application.guardianRelationship, phone: application.guardianPhone, email: application.guardianEmail } : undefined,
    })
    const now = new Date()
    const [updated] = await db.update(tables.admissionApplications).set({ status: 'approved', resultingStudentId: result.student.id, reviewedAt: now, reviewedBy: user.id, updatedAt: now }).where(eq(tables.admissionApplications.id, id)).returning()
    await writeAuditLog({ organizationId: user.organizationId!, actorUserId: user.id, action: 'admission.approved', entityType: 'admission_application', entityId: id, targetLabel: application.referenceNumber, scope: { type: 'dojo', id: application.dojoId }, details: `Created student ${result.student.id}; portal access was not granted` })
    return { application: updated, student: result.student, portalCredentials: null }
  }

  const body = existingApprovalSchema.parse(await readBody(event).catch(() => ({})))
  if (body.feeStartDate && body.feeStartDate < new Date(application.submittedAt).toISOString().slice(0, 10)) throw createError({ statusCode: 400, statusMessage: 'Fee tracking cannot begin before this OpenDojos registration was submitted' })
  const joinedAt = new Date(application.originalJoinedAt || application.submittedAt).toISOString().slice(0, 10)
  let student: any
  let selectedFeePlan: typeof tables.feePlans.$inferSelect | null = null
  let portalCredentials: PortalCredentials | null = null

  if (body.feePlanId) {
    selectedFeePlan = await db.query.feePlans.findFirst({ where: and(eq(tables.feePlans.id, body.feePlanId), eq(tables.feePlans.organizationId, user.organizationId!)) }) || null
    if (!selectedFeePlan || (selectedFeePlan.dojoId && selectedFeePlan.dojoId !== application.dojoId) || (selectedFeePlan.scopeNodeId && !await isDojoWithinHierarchyNode(user.organizationId!, application.dojoId, selectedFeePlan.scopeNodeId))) throw createError({ statusCode: 400, statusMessage: 'Choose a fee plan available to this dojo' })
  }

  if (body.matchedStudentId) {
    student = await db.query.students.findFirst({ where: and(eq(tables.students.id, body.matchedStudentId), eq(tables.students.organizationId, user.organizationId!)) })
    if (!student || (student.dojoId && !await isDojoAccessible(user.id, user.organizationId!, student.dojoId))) throw createError({ statusCode: 403, statusMessage: 'The selected matching student is not accessible' })
    const isDuplicate = student.email === application.email || student.phone === application.phone || (application.membershipNumber && student.membershipNumber === application.membershipNumber) || (student.firstName === application.firstName && student.lastName === application.lastName && student.dateOfBirth && new Date(student.dateOfBirth).getTime() === new Date(application.dateOfBirth).getTime())
    if (!isDuplicate) throw createError({ statusCode: 409, statusMessage: 'The selected record does not match this registration' })
    if (selectedFeePlan) {
      const active = await db.query.studentFeeAssignments.findMany({ where: and(eq(tables.studentFeeAssignments.studentId, student.id), eq(tables.studentFeeAssignments.status, 'active')), with: { feePlan: true } }) as any[]
      if (selectedFeePlan.frequency !== 'one-time' && active.some(item => item.feePlan.frequency !== 'one-time')) throw createError({ statusCode: 409, statusMessage: 'The matching student already has an active recurring fee plan' })
    }
    ;[student] = await db.update(tables.students).set({
      dojoId: application.dojoId, programId: application.programId, currentBeltRankId: application.currentBeltRankId, firstName: application.firstName, lastName: application.lastName,
      email: application.email, phone: application.phone, membershipNumber: application.membershipNumber, dateOfBirth: application.dateOfBirth, joinedAt: application.originalJoinedAt || student.joinedAt, gender: application.gender,
      address: application.address, city: application.city, stateProvince: application.stateProvince, country: application.country, postalCode: application.postalCode,
      emergencyContact: application.emergencyContact, emergencyPhone: application.emergencyPhone, medicalNotes: application.medicalNotes, avatar: application.photoPath, updatedAt: new Date(),
    }).where(eq(tables.students.id, student.id)).returning()
    if (application.currentBeltRankId) {
      const grading = await db.query.studentGradings.findFirst({ where: and(eq(tables.studentGradings.studentId, student.id), eq(tables.studentGradings.beltRankId, application.currentBeltRankId)) })
      if (!grading) await db.insert(tables.studentGradings).values({ studentId: student.id, beltRankId: application.currentBeltRankId, awardedDate: application.currentBeltAwardedAt || application.originalJoinedAt || new Date(), notes: 'Existing rank verified during OpenDojos registration' })
    }
    if (application.programId) {
      const programEnrollment = await db.query.studentProgramEnrollments.findFirst({ where: and(eq(tables.studentProgramEnrollments.studentId, student.id), eq(tables.studentProgramEnrollments.programId, application.programId), eq(tables.studentProgramEnrollments.status, 'active')) })
      if (!programEnrollment) await db.insert(tables.studentProgramEnrollments).values({ studentId: student.id, programId: application.programId, dojoId: application.dojoId, startDate: application.originalJoinedAt || new Date(), status: 'active' })
    }
    if (application.guardianName && application.guardianRelationship) {
      const guardian = await db.query.guardians.findFirst({ where: eq(tables.guardians.studentId, student.id) })
      const values = { name: application.guardianName, relationship: application.guardianRelationship, phone: application.guardianPhone, email: application.guardianEmail }
      if (guardian) await db.update(tables.guardians).set(values).where(eq(tables.guardians.id, guardian.id)); else await db.insert(tables.guardians).values({ studentId: student.id, ...values })
    }
  } else {
    const result = await enrollStudent(user.id, user.organizationId!, {
      dojoId: application.dojoId, programId: application.programId, currentBeltRankId: application.currentBeltRankId, initialRankAwardedAt: application.currentBeltAwardedAt ? new Date(application.currentBeltAwardedAt).toISOString().slice(0, 10) : undefined, firstName: application.firstName, lastName: application.lastName,
      email: application.email, phone: application.phone, membershipNumber: application.membershipNumber, dateOfBirth: new Date(application.dateOfBirth).toISOString().slice(0, 10), joinedAt, gender: application.gender,
      address: application.address, city: application.city, stateProvince: application.stateProvince, country: application.country, postalCode: application.postalCode,
      emergencyContact: application.emergencyContact, emergencyPhone: application.emergencyPhone, medicalNotes: application.medicalNotes, status: 'active', avatar: application.photoPath,
      feePlanId: body.feePlanId, feeStartDate: body.feeStartDate, autoAssignDefaultFeePlan: false, initialDiscount: 0, grantPortalAccess: body.grantPortalAccess,
      guardian: application.guardianName && application.guardianRelationship ? { name: application.guardianName, relationship: application.guardianRelationship, phone: application.guardianPhone, email: application.guardianEmail } : undefined,
    })
    student = result.student; portalCredentials = result.portalCredentials
  }

  if (body.matchedStudentId && body.feePlanId) {
    const startDate = new Date(`${body.feeStartDate}T00:00:00.000Z`)
    await db.insert(tables.studentFeeAssignments).values({ studentId: student.id, feePlanId: selectedFeePlan!.id, startDate, dueDay: Math.min(Math.max(startDate.getUTCDate(), 1), 28), discount: 0, status: 'active' })
  }
  if (body.matchedStudentId && body.grantPortalAccess) portalCredentials = await createPortalAccount(student)
  const now = new Date()
  const [updated] = await db.update(tables.admissionApplications).set({ status: 'approved', resultingStudentId: student.id, reviewedAt: now, reviewedBy: user.id, updatedAt: now }).where(eq(tables.admissionApplications.id, id)).returning()
  await writeAuditLog({ organizationId: user.organizationId!, actorUserId: user.id, action: body.matchedStudentId ? 'existing_registration.matched' : 'existing_registration.approved', entityType: 'admission_application', entityId: id, targetLabel: application.referenceNumber, scope: { type: 'dojo', id: application.dojoId }, details: `${body.matchedStudentId ? 'Updated' : 'Created'} student ${student.id}; fee tracking ${body.feePlanId ? `starts ${body.feeStartDate}` : 'not assigned'}; portal ${body.grantPortalAccess ? 'requested' : 'not granted'}` })
  return { application: updated, student, portalCredentials }
})
