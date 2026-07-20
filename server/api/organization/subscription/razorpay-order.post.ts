import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { createRazorpayOrder, razorpayPlans } from '../../../utils/razorpay'

const bodySchema = z.object({ plan: z.enum(razorpayPlans), billingPeriod: z.enum(['monthly', 'annual']) })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can manage billing.' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId), columns: { id: true, name: true, subscriptionStatus: true } })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  if (organization.subscriptionStatus === 'active') throw createError({ statusCode: 409, statusMessage: 'Your organization already has an active paid plan.' })
  const order = await createRazorpayOrder(body.plan, body.billingPeriod, organization.id, organization.name)
  await db.update(tables.organizations).set({ subscriptionPlan: body.plan, subscriptionStatus: 'pending_payment', billingPeriod: body.billingPeriod, paymentProvider: 'razorpay', providerSubscriptionId: order.id, updatedAt: new Date() }).where(eq(tables.organizations.id, organization.id))
  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: useRuntimeConfig().public.razorpayKeyId, testMode: String(useRuntimeConfig().razorpayKeyId).startsWith('rzp_test_') }
})
