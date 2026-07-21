import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { and, eq } from 'drizzle-orm'
import { isDojoAccessible } from '../../utils/permissions'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({ name: z.string().trim().min(2), scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(['draft', 'open', 'completed', 'cancelled']).optional() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event); const id = Number(getRouterParam(event, 'id'))
  if (!session?.user?.organizationId || !id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const exam = await db.query.gradingExams.findFirst({ where: and(eq(tables.gradingExams.id, id), eq(tables.gradingExams.organizationId, session.user.organizationId)) })
  if (!exam || !await isDojoAccessible(session.user.id, session.user.organizationId, exam.dojoId)) throw createError({ statusCode: 404, statusMessage: 'Grading exam not found' })
  const atNoon = (date: string) => new Date(`${date}T12:00:00.000Z`)
  const [updated] = await db.update(tables.gradingExams).set({ ...body, scheduledAt: atNoon(body.scheduledAt) }).where(eq(tables.gradingExams.id, id)).returning()
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'grading_exam.updated', entityType: 'grading_exam', entityId: id, targetLabel: updated.name, scope: { type: 'dojo', id: exam.dojoId } })
  return updated
})
