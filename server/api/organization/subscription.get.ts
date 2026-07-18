import { getSubscriptionUsage } from '../../utils/subscription'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  // Plan limits drive affordances throughout the workspace (for example, the
  // staff, dojo, and student screens). This response deliberately contains
  // only entitlement and aggregate usage data, never billing-provider IDs,
  // so every organization member may read it without exposing billing data.

  const subscription = await getSubscriptionUsage(session.user.organizationId)
  const testPlanChanges = session.user.role === 'owner' && (process.env.NODE_ENV !== 'production' || process.env.NUXT_ENABLE_TEST_PLAN_CHANGES === 'true')

  return { ...subscription, testPlanChanges }
})
