import { and, eq } from 'drizzle-orm'
import { db, tables } from '../utils/database'
import { isDojoAccessible } from '../utils/permissions'

export default defineEventHandler(async event => {
  const match = getRequestPath(event).match(/^\/api\/students\/(\d+)(?:\/|$)/)
  if (!match) return
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) return
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, Number(match[1])), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (student.dojoId ? !await isDojoAccessible(session.user.id, session.user.organizationId, student.dojoId) : session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'This student is outside your assigned territory' })
  }
})
