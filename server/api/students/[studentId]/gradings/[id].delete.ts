import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { writeAuditLog } from '../../../../utils/audit'
import { syncCurrentBeltRank } from '../../../../utils/gradings'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  const gradingId = getRouterParam(event, 'id')
  if (!studentId || !gradingId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify student belongs to organization
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  // Verify grading exists and belongs to the student
  const grading = await db.query.studentGradings.findFirst({
    where: and(
      eq(tables.studentGradings.id, Number(gradingId)),
      eq(tables.studentGradings.studentId, Number(studentId))
    ),
  })
  if (!grading) {
    throw createError({ statusCode: 404, statusMessage: 'Grading not found' })
  }

  // Delete the grading
  await db.delete(tables.studentGradings)
    .where(eq(tables.studentGradings.id, Number(gradingId)))

  await syncCurrentBeltRank(Number(studentId))

  await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: 'grading.deleted', entityType: 'student_grading', entityId: grading.id, targetLabel: `${student.firstName} ${student.lastName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' } })

  return { success: true }
})
