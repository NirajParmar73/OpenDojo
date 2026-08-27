import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../utils/database'
import { assertDojoManagementAccess, isDojoWithinHierarchyNode } from '../utils/permissions'
import { assertStudentLimit } from '../utils/subscription'
import { generateTemporaryPassword, studentPortalUsername, type PortalCredentials } from '../utils/student-portal'

const guardianSchema = z.object({
  name: z.string().trim().min(1),
  relationship: z.string().trim().min(1),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email().optional().nullable(),
})

export const createStudentSchema = z.object({
  dojoId: z.number().int().positive().nullable(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  membershipNumber: z.string().trim().max(100).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  joinedAt: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateProvince: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).optional().nullable(),
  subdivisionCode: z.string().trim().max(20).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  avatar: z.string().nullable().optional(),
  programId: z.number().int().positive().nullable().optional(),
  currentBeltRankId: z.number().int().positive().nullable().optional(),
  initialRankAwardedAt: z.string().date().optional(),
  feePlanId: z.number().int().positive().nullable().optional(),
  feeStartDate: z.string().date().optional(),
  autoAssignDefaultFeePlan: z.boolean().default(true),
  initialDiscount: z.number().int().nonnegative().default(0),
  discountReason: z.string().trim().max(500).optional(),
  guardian: guardianSchema.optional(),
  grantPortalAccess: z.boolean().optional(),
}).refine(body => body.initialDiscount === 0 || !!body.discountReason, { message: 'A discount reason is required', path: ['discountReason'] })

export type CreateStudentInput = z.infer<typeof createStudentSchema>

export async function enrollStudent(actorUserId: number, organizationId: number, input: CreateStudentInput) {
  const body = createStudentSchema.parse(input)
  if (!body.dojoId) throw createError({ statusCode: 400, statusMessage: 'Create and select a dojo before adding a student' })

  const selectedDojo = await db.query.dojos.findFirst({ where: eq(tables.dojos.id, body.dojoId) })
  if (!selectedDojo || selectedDojo.organizationId !== organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
  }
  await assertDojoManagementAccess(actorUserId, organizationId, body.dojoId)
  await assertStudentLimit(organizationId)
  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, organizationId),
    columns: { autoGrantStudentPortalAccess: true },
  })
  const grantPortalAccess = body.grantPortalAccess ?? organization?.autoGrantStudentPortalAccess ?? true

  if (body.programId) {
    const program = await db.query.organizationPrograms.findFirst({ where: eq(tables.organizationPrograms.id, body.programId) })
    if (!program || program.organizationId !== organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid program' })
  }

  if (body.currentBeltRankId) {
    const rank = await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, body.currentBeltRankId), with: { system: true } }) as any
    if (!rank || rank.system.organizationId !== organizationId || (body.programId && rank.system.programId && rank.system.programId !== body.programId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid belt rank' })
    }
  }

  const feePlanId = body.feePlanId === undefined && body.autoAssignDefaultFeePlan
    ? selectedDojo.defaultFeePlanId
    : body.feePlanId
  if (feePlanId) {
    const feePlan = await db.query.feePlans.findFirst({ where: eq(tables.feePlans.id, feePlanId) })
    if (!feePlan || feePlan.organizationId !== organizationId || (feePlan.dojoId && feePlan.dojoId !== body.dojoId) || (feePlan.scopeNodeId && !await isDojoWithinHierarchyNode(organizationId, body.dojoId, feePlan.scopeNodeId))) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid fee plan' })
    }
  }

  const enrollment = await db.transaction(async (tx) => {
    const data: typeof tables.students.$inferInsert = {
      organizationId,
      dojoId: body.dojoId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      membershipNumber: body.membershipNumber || null,
      gender: body.gender || null,
      address: body.address || null,
      city: body.city || null,
      stateProvince: body.stateProvince || null,
      country: body.country || null,
      countryCode: body.countryCode || null,
      subdivisionCode: body.subdivisionCode || null,
      postalCode: body.postalCode || null,
      emergencyContact: body.emergencyContact || null,
      emergencyPhone: body.emergencyPhone || null,
      medicalNotes: body.medicalNotes || null,
      status: body.status,
      avatar: body.avatar || null,
      programId: body.programId || null,
      currentBeltRankId: body.currentBeltRankId || null,
      ...(body.dateOfBirth ? { dateOfBirth: new Date(`${body.dateOfBirth}T00:00:00.000Z`) } : {}),
      ...(body.joinedAt ? { joinedAt: new Date(`${body.joinedAt}T00:00:00.000Z`) } : {}),
    }
    const [student] = await tx.insert(tables.students).values(data).returning()
    if (!student) throw createError({ statusCode: 500, statusMessage: 'Failed to create student' })

    if (body.currentBeltRankId) {
      await tx.insert(tables.studentGradings).values({
        studentId: student.id,
        beltRankId: body.currentBeltRankId,
        awardedDate: body.initialRankAwardedAt ? new Date(`${body.initialRankAwardedAt}T00:00:00.000Z`) : student.joinedAt,
        notes: 'Initial rank recorded when the student joined',
      })
    }

    const [programEnrollment] = body.programId
      ? await tx.insert(tables.studentProgramEnrollments).values({
          studentId: student.id,
          programId: body.programId,
          dojoId: student.dojoId,
          startDate: student.joinedAt,
          status: 'active',
        }).returning()
      : [null]

    if (feePlanId) {
      await tx.insert(tables.studentFeeAssignments).values({
        studentId: student.id,
        feePlanId,
        programEnrollmentId: programEnrollment?.id || null,
        startDate: body.feeStartDate ? new Date(`${body.feeStartDate}T00:00:00.000Z`) : student.joinedAt,
        dueDay: Math.min(Math.max((body.feeStartDate ? new Date(`${body.feeStartDate}T00:00:00.000Z`) : student.joinedAt).getUTCDate(), 1), 28),
        discount: body.initialDiscount,
        discountReason: body.initialDiscount ? body.discountReason : null,
        status: 'active',
      })
    }

    if (body.guardian) {
      await tx.insert(tables.guardians).values({
        studentId: student.id,
        name: body.guardian.name,
        relationship: body.guardian.relationship,
        phone: body.guardian.phone || null,
        email: body.guardian.email || null,
      })
    }
    let portalCredentials: PortalCredentials | null = null
    if (grantPortalAccess) {
      const temporaryPassword = generateTemporaryPassword()
      const username = studentPortalUsername(student.firstName, student.lastName, student.id)
      await tx.insert(tables.studentPortalAccounts).values({
        studentId: student.id,
        username,
        passwordHash: await hashPassword(temporaryPassword),
        isActive: 1,
        mustChangePassword: true,
      })
      portalCredentials = {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        username,
        temporaryPassword,
      }
    }
    return { studentId: student.id, portalCredentials }
  })

  const student = await db.query.students.findFirst({
    where: eq(tables.students.id, enrollment.studentId),
    with: { dojo: true, program: true, currentBeltRank: true },
  })
  if (!student) throw createError({ statusCode: 500, statusMessage: 'Failed to load created student' })
  return { student, portalCredentials: enrollment.portalCredentials }
}
