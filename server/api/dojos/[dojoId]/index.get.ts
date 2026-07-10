import { db, tables } from '../../../utils/database'
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

  const dojo = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, orgId)
    ),
    with: { node: true, schedules: { with: { instructor: true } } },
  })
  if (!dojo) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  return dojo
})