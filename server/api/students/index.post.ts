// server/api/students/index.post.ts
import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { assertDojoManagementAccess } from '../../utils/permissions'
import { assertStudentLimit } from '../../utils/subscription'

const createStudentSchema = z.object({
  dojoId: z.number().int().positive().nullable(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  joinedAt: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  // ✅ new fields
  avatar: z.string().nullable().optional(),
  currentBeltRankId: z.number().int().positive().nullable().optional(),
  feePlanId: z.number().int().positive().nullable().optional(),
  autoAssignDefaultFeePlan: z.boolean().default(true),
  initialDiscount: z.number().int().nonnegative().default(0),
  discountReason: z.string().trim().max(500).optional(),
}).refine(body => body.initialDiscount === 0 || !!body.discountReason, { message: 'A discount reason is required', path: ['discountReason'] })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const body = await readValidatedBody(event, createStudentSchema.parse)
  let selectedDojo: { defaultFeePlanId: number | null } | null = null

  // Students must belong to a dojo. This keeps enrolment aligned with the
  // getting-started workflow and prevents unassigned student records.
  if (!body.dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Create and select a dojo before adding a student' })
  }

  // Validate dojo
  if (body.dojoId) {
    const dojo = await db.query.dojos.findFirst({
      where: eq(tables.dojos.id, body.dojoId),
    })
    if (!dojo || dojo.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
    }
    await assertDojoManagementAccess(session.user.id, orgId, body.dojoId)
    selectedDojo = dojo
  }
  await assertStudentLimit(orgId, body.dojoId)

  // Validate belt rank if provided
  if (body.currentBeltRankId) {
    const rank = await db.query.beltRanks.findFirst({
      where: eq(tables.beltRanks.id, body.currentBeltRankId),
      with: { system: true },
    }) as any
    if (!rank || rank.system.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid belt rank' })
    }
  }

  const data: any = {
    organizationId: orgId,
    dojoId: body.dojoId || null,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email || null,
    phone: body.phone || null,
    gender: body.gender || null,
    address: body.address || null,
    emergencyContact: body.emergencyContact || null,
    emergencyPhone: body.emergencyPhone || null,
    medicalNotes: body.medicalNotes || null,
    status: body.status,
    avatar: body.avatar || null,
    currentBeltRankId: body.currentBeltRankId || null,
  }

  if (body.dateOfBirth) {
    data.dateOfBirth = new Date(body.dateOfBirth)
  }

  const feePlanId = body.feePlanId === undefined && body.autoAssignDefaultFeePlan
    ? selectedDojo?.defaultFeePlanId
    : body.feePlanId
  if (feePlanId) {
    const feePlan = await db.query.feePlans.findFirst({ where: eq(tables.feePlans.id, feePlanId) })
    if (!feePlan || feePlan.organizationId !== orgId || (feePlan.dojoId && feePlan.dojoId !== body.dojoId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid fee plan' })
    }
  }
  if (body.joinedAt) {
    data.joinedAt = new Date(`${body.joinedAt}T00:00:00.000Z`)
  }

  const [student] = await db.insert(tables.students).values(data).returning() as any[]

  if (!student) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create student' })
  }

  if (feePlanId) {
    await db.insert(tables.studentFeeAssignments).values({
      studentId: student.id,
      feePlanId,
      startDate: student.joinedAt,
      dueDay: Math.min(Math.max(new Date(student.joinedAt).getDate(), 1), 28),
      discount: body.initialDiscount,
      discountReason: body.initialDiscount ? body.discountReason : null,
      status: 'active',
    })
  }

  // Fetch the full student with relations (dojo, belt)
  const fullStudent = await db.query.students.findFirst({
    where: eq(tables.students.id, student.id),
    with: {
      dojo: true,
      currentBeltRank: true,
    },
  })

  return { success: true, student: fullStudent }
})
