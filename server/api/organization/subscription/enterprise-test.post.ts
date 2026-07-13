import { eq } from 'drizzle-orm'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can change the test plan.' })

  const testPlanChanges = process.env.NODE_ENV !== 'production' || process.env.NUXT_ENABLE_TEST_PLAN_CHANGES === 'true'
  if (!testPlanChanges) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const [organization] = await db.update(tables.organizations)
    .set({ subscriptionPlan: 'enterprise', updatedAt: new Date() })
    .where(eq(tables.organizations.id, session.user.organizationId))
    .returning({ id: tables.organizations.id, name: tables.organizations.name })

  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  await writeAuditLog({
    organizationId: organization.id,
    actorUserId: session.user.id,
    action: 'test_subscription_activated',
    entityType: 'organization',
    entityId: organization.id,
    targetLabel: organization.name,
    scope: { type: 'organization' },
    details: 'Enterprise plan activated through the development test control.'
  })

  return { plan: 'enterprise' }
})
