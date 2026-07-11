import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const sessionId = getRouterParam(event, 'sessionId')
  if (!sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing session ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // ✅ Cast to any to avoid TypeScript relation inference issues
  const sessionRecord = await db.query.classSessions.findFirst({
    where: eq(tables.classSessions.id, Number(sessionId)),
    with: {
      dojo: true,
    },
  }) as any

  if (!sessionRecord) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }
  if (sessionRecord.dojo?.organizationId !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  // Fetch attendance records
  const attendanceRecords = await db.query.attendance.findMany({
    where: eq(tables.attendance.sessionId, Number(sessionId)),
    with: { student: true },
  })

  // Fetch all active students of the dojo
  const allStudents = await db.query.students.findMany({
    where: and(
      eq(tables.students.organizationId, orgId),
      eq(tables.students.dojoId, sessionRecord.dojoId),
      eq(tables.students.status, 'active')
    ),
    orderBy: (s, { asc }) => [asc(s.firstName), asc(s.lastName)],
  })

  const attendanceMap: Record<number, any> = {}
  for (const rec of attendanceRecords) {
    attendanceMap[rec.studentId] = rec
  }

  const result = allStudents.map(student => {
    const existing = attendanceMap[student.id]
    return {
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      status: existing?.status || 'unmarked',
      notes: existing?.notes || '',
      attendanceId: existing?.id || null,
    }
  })

  return {
    session: sessionRecord,
    attendance: result,
  }
})