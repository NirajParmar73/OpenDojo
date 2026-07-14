import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../utils/permissions'

const updateAssignmentSchema = z.object({
  endDate: z.string().optional().nullable(),
  dueDay: z.number().int().min(1).max(28).optional(),
  discount: z.number().int().min(0).optional(),
  discountReason: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['active', 'expired', 'cancelled']).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  const assignmentId = getRouterParam(event, 'id')
  if (!studentId || !assignmentId) {
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
  if (student.dojoId ? !await isDojoAccessible(session.user.id, orgId, student.dojoId) : session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  // Verify assignment exists
  const existing = await db.query.studentFeeAssignments.findFirst({
    where: and(
      eq(tables.studentFeeAssignments.id, Number(assignmentId)),
      eq(tables.studentFeeAssignments.studentId, Number(studentId))
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Assignment not found' })
  }

  const body = await readValidatedBody(event, updateAssignmentSchema.parse)

  const updateData: any = {}
  if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null
  if (body.dueDay !== undefined) updateData.dueDay = body.dueDay
  if (body.discount !== undefined) updateData.discount = body.discount
  if (body.discountReason !== undefined) updateData.discountReason = body.discountReason
  if (body.status !== undefined) updateData.status = body.status
  updateData.updatedAt = new Date()

  const [updated] = await db.update(tables.studentFeeAssignments)
    .set(updateData)
    .where(eq(tables.studentFeeAssignments.id, Number(assignmentId)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update assignment' })
  }

  return { success: true, assignment: updated }
})
