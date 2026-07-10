import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

const updateGuardianSchema = z.object({
  name: z.string().min(1).optional(),
  relationship: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  const guardianId = getRouterParam(event, 'id')
  if (!studentId || !guardianId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })
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

  // Verify guardian exists and belongs to the student
  const existing = await db.query.guardians.findFirst({
    where: and(
      eq(tables.guardians.id, Number(guardianId)),
      eq(tables.guardians.studentId, Number(studentId))
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Guardian not found' })
  }

  const body = await readValidatedBody(event, updateGuardianSchema.parse)

  const updateData: any = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.relationship !== undefined) updateData.relationship = body.relationship
  if (body.phone !== undefined) updateData.phone = body.phone
  if (body.email !== undefined) updateData.email = body.email
  if (body.address !== undefined) updateData.address = body.address
  updateData.updatedAt = new Date()

  const [updated] = await db.update(tables.guardians)
    .set(updateData)
    .where(eq(tables.guardians.id, Number(guardianId)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update guardian' })
  }

  return { success: true, guardian: updated }
})