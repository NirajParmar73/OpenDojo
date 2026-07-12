import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
    with: { dojo: true },
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  const query = getQuery(event)
  const { from, to } = querySchema.parse(query)
  const fromTs = from ? new Date(from).getTime() : undefined
  const toTs = to ? new Date(to).getTime() : undefined

  // ✅ Fetch all records without orderBy
  const allRecords = (await db.query.attendance.findMany({
    where: eq(tables.attendance.studentId, Number(studentId)),
    with: {
      session: {
        with: {
          dojo: true,
          instructor: true,
        },
      },
    },
  })) as any[]

  // Filter and sort in JavaScript
  const filtered = allRecords
    .filter((rec) => {
      const recordDate = rec.session?.date
      if (fromTs && recordDate < fromTs) return false
      if (toTs && recordDate > toTs) return false
      return true
    })
    .sort((a, b) => {
      // Sort by date descending, then by startTime descending
      const dateA = a.session?.date || 0
      const dateB = b.session?.date || 0
      if (dateA !== dateB) return dateB - dateA
      const timeA = a.session?.startTime || ''
      const timeB = b.session?.startTime || ''
      return timeB.localeCompare(timeA)
    })

  const records = filtered.map((rec) => {
    const r = rec
    return {
      id: r.id,
      date: r.session?.date,
      startTime: r.session?.startTime,
      endTime: r.session?.endTime,
      dojoName: r.session?.dojo?.name ?? 'N/A',
      instructorName: r.session?.instructor?.name ?? 'N/A',
      className: r.session?.name ?? 'Class',
      status: r.status,
      notes: r.notes,
    }
  })

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      dojo: student.dojo,
    },
    records,
  }
})