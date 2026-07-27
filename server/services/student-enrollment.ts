import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../utils/database'
import { assertDojoManagementAccess, isDojoWithinHierarchyNode } from '../utils/permissions'
import { assertStudentLimit } from '../utils/subscription'

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
  feePlanId: z.number().int().positive().nullable().optional(),
  autoAssignDefaultFeePlan: z.boolean().default(true),
  initialDiscount: z.number().int().nonnegative().default(0),
  discountReason: z.string().trim().max(500).optional(),
  guardian: guardianSchema.optional(),
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

  const studentId = await db.transaction(async (tx) => {
    const data: typeof tables.students.$inferInsert = {
      organizationId,
      dojoId: body.dojoId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
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
        awardedDate: student.joinedAt,
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
        startDate: student.joinedAt,
        dueDay: Math.min(Math.max(student.joinedAt.getDate(), 1), 28),
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
    return student.id
  })

  const student = await db.query.students.findFirst({
    where: eq(tables.students.id, studentId),
    with: { dojo: true, program: true, currentBeltRank: true },
  })
  if (!student) throw createError({ statusCode: 500, statusMessage: 'Failed to load created student' })
  return student
}
