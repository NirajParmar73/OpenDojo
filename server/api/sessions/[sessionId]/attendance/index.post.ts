import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

const attendanceItemSchema = z.object({
  studentId: z.number().int().positive(),
  status: z.enum(['present', 'absent', 'late', 'excused', 'unmarked']),
  notes: z.string().optional().nullable(),
  attendanceId: z.number().int().positive().nullable().optional(),
})

const bulkUpdateSchema = z.object({
  items: z.array(attendanceItemSchema),
})

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

  // ✅ Cast to any
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

  const body = await readValidatedBody(event, bulkUpdateSchema.parse)

  for (const item of body.items) {
    if (item.status === 'unmarked') {
      if (item.attendanceId) {
        await db.delete(tables.attendance)
          .where(eq(tables.attendance.id, item.attendanceId))
      }
      continue
    }

    // Verify student exists and belongs to organization
    const student = await db.query.students.findFirst({
      where: and(
        eq(tables.students.id, item.studentId),
        eq(tables.students.organizationId, orgId)
      ),
    })
    if (!student) continue // skip if not found

    if (item.attendanceId) {
      await db.update(tables.attendance)
        .set({
          status: item.status,
          notes: item.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(tables.attendance.id, item.attendanceId))
    } else {
      await db.insert(tables.attendance).values({
        sessionId: Number(sessionId),
        studentId: item.studentId,
        status: item.status,
        notes: item.notes || null,
      })
    }
  }

  return { success: true }
})