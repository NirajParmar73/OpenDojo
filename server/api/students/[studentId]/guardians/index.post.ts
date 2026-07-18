import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

const createGuardianSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().trim().max(100).optional(),
  stateProvince: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).optional(),
  subdivisionCode: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(20).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify student
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  const body = await readValidatedBody(event, createGuardianSchema.parse)

  const [guardian] = await db.insert(tables.guardians).values({
    studentId: Number(studentId),
    name: body.name,
    relationship: body.relationship,
    phone: body.phone || null,
    email: body.email || null,
    address: body.address || null,
    city: body.city || null,
    stateProvince: body.stateProvince || null,
    country: body.country || null,
    countryCode: body.countryCode || null,
    subdivisionCode: body.subdivisionCode || null,
    postalCode: body.postalCode || null,
  }).returning() as any[]

  if (!guardian) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create guardian' })
  }

  return { success: true, guardian }
})
