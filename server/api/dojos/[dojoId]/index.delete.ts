import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess } from '../../../utils/permissions'
import { getSubscription } from '../../../utils/subscription'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }


  const dojoId = getRouterParam(event, 'dojoId')
  if (!dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const existing = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, session.user.organizationId!)
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }
  await assertDojoManagementAccess(session.user.id, session.user.organizationId!, existing.id)
  const subscription = await getSubscription(session.user.organizationId!)
  if (subscription.plan === 'free') {
    throw createError({ statusCode: 402, statusMessage: 'Free Forever includes one dojo. Upgrade before removing or replacing your initial location.' })
  }

  const [deleted] = await db.delete(tables.dojos)
    .where(eq(tables.dojos.id, Number(dojoId)))
    .returning() as any[]

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  return { success: true }
})
