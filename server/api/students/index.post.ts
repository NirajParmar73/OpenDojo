import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'
import { isDojoAccessible } from '../../../server/utils/permissions'

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

  // ----- Permission checks -----
  if (body.dojoId) {
    // Check if the user has access to the given dojo
    const accessible = await isDojoAccessible(session.user.id, orgId, body.dojoId)
    if (!accessible) {
      throw createError({ statusCode: 403, statusMessage: 'You do not have access to this dojo' })
    }
  } else {
    // If no dojoId is provided, only owner/admin can create a student without a dojo
    // We need to check the user's primary role
    const user = await db.query.users.findFirst({
      where: eq(tables.users.id, session.user.id),
    })
    if (!user || !['owner', 'admin'].includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Only owners and admins can create students without a dojo' })
    }
  }

  // If dojoId is provided, verify it belongs to the organization
  if (body.dojoId) {
    const dojo = await db.query.dojos.findFirst({
      where: eq(tables.dojos.id, body.dojoId),
    })
    if (!dojo || dojo.organizationId !== orgId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
    }
  }

  // Prepare data
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
  }

  if (body.dateOfBirth) {
    data.dateOfBirth = new Date(body.dateOfBirth)
  }

  const [student] = await db.insert(tables.students).values(data).returning() as any[]

  if (!student) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create student' })
  }

  return { success: true, student }
})