import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { assertDojoManagementAccess } from '../../../../utils/permissions'
const schema = z.object({ userId: z.number().int().positive(), programId: z.number().int().positive().nullable(), isPrimary: z.boolean().optional() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event); const dojoId = Number(getRouterParam(event, 'dojoId'))
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const dojo = await db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, dojoId), eq(tables.dojos.organizationId, session.user.organizationId)) })
  if (dojo) await assertDojoManagementAccess(session.user.id, session.user.organizationId, dojoId)
  const user = await db.query.users.findFirst({ where: and(eq(tables.users.id, body.userId), eq(tables.users.organizationId, session.user.organizationId)), with: { assignments: true } })
  if (!dojo || !user || (user.role !== 'owner' && !user.assignments.some(assignment => ['instructor', 'dojo_head'].includes(assignment.role)))) throw createError({ statusCode: 400, statusMessage: 'Select an eligible instructor' })
  if (body.isPrimary) await db.update(tables.dojoInstructors).set({ isPrimary: 0 }).where(eq(tables.dojoInstructors.dojoId, dojoId))
  const [assignment] = await db.insert(tables.dojoInstructors).values({ dojoId, userId: body.userId, programId: body.programId, isPrimary: body.isPrimary ? 1 : 0 }).returning()
  return { success: true, assignment }
})
