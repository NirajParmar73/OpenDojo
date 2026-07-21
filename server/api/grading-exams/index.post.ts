import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../utils/permissions'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({ dojoIds: z.array(z.number().int().positive()).min(1, 'Select at least one dojo'), name: z.string().trim().min(2), scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select an exam date') })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const dojoIds = [...new Set(body.dojoIds)]
  const dojos = await db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, session.user.organizationId) })
  const selectedDojos = dojos.filter(dojo => dojoIds.includes(dojo.id))
  if (selectedDojos.length !== dojoIds.length) throw createError({ statusCode: 400, statusMessage: 'One or more selected dojos are invalid' })
  if (await Promise.all(selectedDojos.map(dojo => isDojoAccessible(session.user.id, session.user.organizationId, dojo.id))).then(access => access.some(allowed => !allowed))) throw createError({ statusCode: 403, statusMessage: 'Access denied for one or more selected dojos' })
  // Dates are intentionally stored at noon UTC so a date-only exam never
  // shifts to the previous/next calendar day when displayed in a timezone.
  const dateAtNoonUtc = (date: string) => new Date(`${date}T12:00:00.000Z`)
  const exams = await db.insert(tables.gradingExams).values(selectedDojos.map(dojo => ({ organizationId: session.user.organizationId, dojoId: dojo.id, name: body.name, scheduledAt: dateAtNoonUtc(body.scheduledAt), status: 'open' }))).returning()
  await Promise.all(exams.map(exam => writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'grading_exam.created', entityType: 'grading_exam', entityId: exam.id, targetLabel: body.name, scope: { type: 'dojo', id: exam.dojoId } })))
  return { success: true, exams }
})
