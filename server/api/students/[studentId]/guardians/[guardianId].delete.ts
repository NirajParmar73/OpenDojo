import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

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

  await db.delete(tables.guardians)
    .where(eq(tables.guardians.id, Number(guardianId)))

  return { success: true }
})