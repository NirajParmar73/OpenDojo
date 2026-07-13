import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../utils/permissions'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const id = getRouterParam(event, 'studentId')
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
    const hasOrgWideRole = session.user.role === 'owner'
    if (!hasOrgWideRole) {
      throw createError({ statusCode: 403, statusMessage: 'You cannot delete this student' })
    }
  }

  // Soft delete: update status to 'archived'
  await db.update(tables.students)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(tables.students.id, Number(id)))
  await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: 'student.archived', entityType: 'student', entityId: student.id, targetLabel: `${student.firstName} ${student.lastName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' } })

  return { success: true }
})
