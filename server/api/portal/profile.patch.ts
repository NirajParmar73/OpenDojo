import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

const schema = z.object({ email: z.string().trim().email().nullable().optional(), phone: z.string().trim().max(50).nullable().optional(), address: z.string().trim().max(1000).nullable().optional(), emergencyContact: z.string().trim().max(255).nullable().optional(), emergencyPhone: z.string().trim().max(50).nullable().optional() })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number((session?.user as unknown as Record<string, unknown>)?.studentId)
  if (!studentId || session?.user?.role !== 'student' || !session.user.organizationId) throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  const body = await readValidatedBody(event, schema.parse)
  const [student] = await db.update(tables.students).set({ ...body, updatedAt: new Date() }).where(and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId))).returning()
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  return { success: true, student }
})
