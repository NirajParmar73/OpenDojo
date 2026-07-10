import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

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

  const guardians = await db.query.guardians.findMany({
    where: eq(tables.guardians.studentId, Number(studentId)),
    orderBy: (g, { asc }) => [asc(g.id)],
  })

  return guardians
})