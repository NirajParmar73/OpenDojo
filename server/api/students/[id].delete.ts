import { db, tables } from '../../../server/utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../server/utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  // Check student exists and get its dojoId
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(id)),
      eq(tables.students.organizationId, orgId)
    ),
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  // Check if user has access to the student's dojo
  if (student.dojoId) {
    const accessible = await isDojoAccessible(session.user.id, orgId, student.dojoId)
    if (!accessible) {
      throw createError({ statusCode: 403, statusMessage: 'You do not have access to this student' })
    }
  } else {
    // Student has no dojo – only owner/admin can delete
    const assignments = await db.query.assignments.findMany({
      where: eq(tables.assignments.userId, session.user.id),
    })
    const hasOrgWideRole = assignments.some(a => a.role === 'owner' || a.role === 'admin')
    if (!hasOrgWideRole) {
      throw createError({ statusCode: 403, statusMessage: 'You cannot delete this student' })
    }
  }

  // Soft delete: update status to 'archived'
  await db.update(tables.students)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(tables.students.id, Number(id)))

  return { success: true }
})