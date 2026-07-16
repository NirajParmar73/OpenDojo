import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || !['owner', 'admin'].includes(session.user.role)) throw createError({ statusCode: 403, statusMessage: 'Only administrators can manage portal access' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const account = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.studentId, studentId) })
  return account ? { username: account.username, isActive: !!account.isActive } : null
})
