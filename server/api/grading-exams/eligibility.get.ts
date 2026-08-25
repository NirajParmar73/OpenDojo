import { getGradingEligibility } from '../../utils/grading-eligibility'
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return getGradingEligibility(session.user.id, session.user.organizationId)
})
