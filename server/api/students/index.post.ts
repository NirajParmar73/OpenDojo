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
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  medicalNotes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  // ✅ new fields
  avatar: z.string().nullable().optional(),
  currentBeltRankId: z.number().int().positive().nullable().optional(),
})

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
  await assertStudentLimit(orgId)

  // Validate dojo if provided
  if (body.dojoId) {
    const dojo = await db.query.dojos.findFirst({
      where: eq(tables.dojos.id, body.dojoId),
    })
    if (!dojo || dojo.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
    }
    await assertDojoManagementAccess(session.user.id, orgId, body.dojoId)
  } else if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can create an unassigned student' })
  }

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

  const [student] = await db.insert(tables.students).values(data).returning() as any[]

  if (!student) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create student' })
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
