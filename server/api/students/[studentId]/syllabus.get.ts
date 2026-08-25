import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { isDojoAccessible } from '../../../utils/permissions'
import { canAssessStudentSyllabus, getStudentSyllabusProgress } from '../../../utils/syllabus'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number(getRouterParam(event, 'studentId'))
  if (!session?.user?.organizationId || !studentId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (student.dojoId ? !await isDojoAccessible(session.user.id, session.user.organizationId, student.dojoId) : session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  const progress = await getStudentSyllabusProgress(studentId, session.user.organizationId)
  return { ...progress, canAssess: await canAssessStudentSyllabus(session.user.id, session.user.organizationId, student.dojoId) }
})
