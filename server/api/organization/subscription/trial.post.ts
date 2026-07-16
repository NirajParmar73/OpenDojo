import { z } from 'zod'
import { billingPeriods, startSubscriptionTrial } from '../../../utils/subscription'
import { writeAuditLog } from '../../../utils/audit'

const bodySchema = z.object({
  plan: z.enum(['city-starter', 'city-pro', 'state-pro', 'national']),
  billingPeriod: z.enum(billingPeriods),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can start a trial.' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const trial = await startSubscriptionTrial(session.user.organizationId, body.plan, body.billingPeriod)
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'subscription_trial_started', entityType: 'organization', entityId: session.user.organizationId, targetLabel: body.plan, scope: { type: 'organization' }, details: `14-day ${body.plan} trial started on ${body.billingPeriod} billing.` })
  return trial
})
