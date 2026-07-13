import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { assertDojoManagementAccess } from '../../../../utils/permissions'
export default defineEventHandler(async event => {
  const session = await getUserSession(event); const dojoId = Number(getRouterParam(event, 'dojoId'))
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const dojo = await db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, dojoId), eq(tables.dojos.organizationId, session.user.organizationId)) })
  if (!dojo) throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  await assertDojoManagementAccess(session.user.id, session.user.organizationId, dojoId)
  const roster = await db.query.dojoInstructors.findMany({ where: eq(tables.dojoInstructors.dojoId, dojoId) })
  const users = await db.query.users.findMany({ where: eq(tables.users.organizationId, session.user.organizationId) }); const programs = await db.query.organizationPrograms.findMany({ where: eq(tables.organizationPrograms.organizationId, session.user.organizationId) })
  return roster.map(item => ({ ...item, user: users.find(user => user.id === item.userId), program: programs.find(program => program.id === item.programId) }))
})
