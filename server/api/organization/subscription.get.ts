import { getSubscriptionUsage } from '../../utils/subscription'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can view subscription details' })

  const subscription = await getSubscriptionUsage(session.user.organizationId)
  const testPlanChanges = process.env.NODE_ENV !== 'production' || process.env.NUXT_ENABLE_TEST_PLAN_CHANGES === 'true'

  return { ...subscription, testPlanChanges }
})
