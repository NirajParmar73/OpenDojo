import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess } from '../../../../utils/permissions'

console.log('✅ Schedules GET handler loaded')
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

  const dojo = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, orgId)
    ),
  })
  if (!dojo) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }
  await assertDojoManagementAccess(session.user.id, orgId, Number(dojoId))

  const schedules = await db.query.dojoSchedules.findMany({
    where: eq(tables.dojoSchedules.dojoId, Number(dojoId)),
    orderBy: (s, { asc }) => [asc(s.dayOfWeek), asc(s.startTime)],
    with: { instructor: true },
  })

  return schedules
})
