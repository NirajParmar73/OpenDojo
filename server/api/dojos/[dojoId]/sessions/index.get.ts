import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dojoId = getRouterParam(event, 'dojoId')
  if (!dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dojo ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify dojo belongs to organization
  const dojo = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, orgId)
    ),
  })
  if (!dojo) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  // ✅ Get the total number of active students in this dojo
  const activeStudents = await db.query.students.findMany({
    where: and(
      eq(tables.students.organizationId, orgId),
      eq(tables.students.dojoId, Number(dojoId)),
      eq(tables.students.status, 'active')
    ),
  })
  const totalStudents = activeStudents.length

  // Fetch all sessions with their attendance records
  const sessions = await db.query.classSessions.findMany({
    where: eq(tables.classSessions.dojoId, Number(dojoId)),
    orderBy: (s, { desc }) => [desc(s.date), desc(s.startTime)],
    with: {
      instructor: true,
      attendance: {
        with: { student: true },
      },
    },
  })

  // Compute stats using totalStudents as the denominator
  const sessionsWithStats = sessions.map(s => {
    const present = s.attendance?.filter(a => a.status === 'present').length || 0
    const absent = s.attendance?.filter(a => a.status === 'absent').length || 0
    const late = s.attendance?.filter(a => a.status === 'late').length || 0
    const excused = s.attendance?.filter(a => a.status === 'excused').length || 0
    return {
      ...s,
      stats: {
        total: totalStudents,
        present,
        absent,
        late,
        excused,
      },
    }
  })

  return sessionsWithStats
})