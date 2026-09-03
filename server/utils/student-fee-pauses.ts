import { and, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { hasFinanceManagementAccess, isDojoAccessible } from './permissions'

export async function requireFeePauseStudent(event: any, mode: 'read' | 'manage') {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const studentId = Number(getRouterParam(event, 'studentId'))
  if (!organizationId || !studentId) throw createError({ statusCode: 400, statusMessage: 'Invalid student request' })

  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)),
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })

  const allowed = mode === 'manage'
    ? await hasFinanceManagementAccess(session.user.id, organizationId, student.dojoId)
    : student.dojoId
      ? await isDojoAccessible(session.user.id, organizationId, student.dojoId)
      : session.user.role === 'owner'
  if (!allowed) {
    throw createError({ statusCode: 403, statusMessage: mode === 'manage' ? 'Fee pauses require finance management access for this territory' : 'Access denied' })
  }

  return { user: session.user, organizationId, studentId, student }
}

export function parseFeePauseDates(startDate: string, endDate?: string | null) {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null
  if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid vacation dates' })
  }
  if (end && end.getTime() - start.getTime() < 27 * 86_400_000) {
    throw createError({ statusCode: 400, statusMessage: 'A fee pause must cover at least 28 calendar days' })
  }
  return { start, end }
}

export function feePausesOverlap(left: { startDate: Date | number, endDate?: Date | number | null }, right: { start: Date, end: Date | null }) {
  const leftStart = new Date(left.startDate)
  const leftEnd = left.endDate ? new Date(left.endDate) : new Date(8_640_000_000_000_000)
  const rightEnd = right.end || new Date(8_640_000_000_000_000)
  return leftStart <= rightEnd && right.start <= leftEnd
}
