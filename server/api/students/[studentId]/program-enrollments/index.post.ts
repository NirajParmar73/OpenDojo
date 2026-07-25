import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { assertDojoManagementAccess } from '../../../../utils/permissions'

const schema = z.object({ programId: z.number().int().positive() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  const studentId = Number(getRouterParam(event, 'studentId'))
  if (!session?.user?.organizationId || !studentId) throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
  const body = await readValidatedBody(event, schema.parse)
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student?.dojoId) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  await assertDojoManagementAccess(session.user.id, session.user.organizationId, student.dojoId)
  const program = await db.query.organizationPrograms.findFirst({ where: and(eq(tables.organizationPrograms.id, body.programId), eq(tables.organizationPrograms.organizationId, session.user.organizationId)) })
  if (!program) throw createError({ statusCode: 400, statusMessage: 'Invalid program' })
  const existing = await db.query.studentProgramEnrollments.findFirst({ where: and(eq(tables.studentProgramEnrollments.studentId, studentId), eq(tables.studentProgramEnrollments.programId, body.programId), eq(tables.studentProgramEnrollments.status, 'active')) })
  if (existing) return { success: true, enrollment: existing }
  const [enrollment] = await db.insert(tables.studentProgramEnrollments).values({ studentId, programId: body.programId, dojoId: student.dojoId, status: 'active' }).returning()
  return { success: true, enrollment }
})
