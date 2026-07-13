import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../utils/permissions'

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

  // Check for linked payments
  const payments = await db.query.payments.findMany({
    where: eq(tables.payments.assignmentId, Number(assignmentId)),
  })
  if (payments.length > 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete assignment with linked payments' })
  }

  await db.delete(tables.studentFeeAssignments)
    .where(eq(tables.studentFeeAssignments.id, Number(assignmentId)))

  return { success: true }
})
