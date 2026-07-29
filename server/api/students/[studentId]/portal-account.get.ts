import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { hasStudentPortalManagementAccess } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (!await hasStudentPortalManagementAccess(session.user.id, session.user.organizationId, student.dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'You can manage portal access only for students in your assigned locations' })
  }
  const account = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.studentId, studentId) })
  return account ? { username: account.username, isActive: !!account.isActive } : null
})
