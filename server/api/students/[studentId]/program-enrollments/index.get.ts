import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { isDojoAccessible } from '../../../../utils/permissions'

export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  const studentId = Number(getRouterParam(event, 'studentId'))
  if (!session?.user?.organizationId || !studentId) throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student || (student.dojoId && !await isDojoAccessible(session.user.id, session.user.organizationId, student.dojoId))) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  return db.query.studentProgramEnrollments.findMany({ where: eq(tables.studentProgramEnrollments.studentId, studentId), with: { program: true }, orderBy: (enrollment, { desc }) => [desc(enrollment.startDate)] })
})
