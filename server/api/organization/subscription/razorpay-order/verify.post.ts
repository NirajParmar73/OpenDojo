import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { verifyRazorpayPaymentSignature } from '../../../../utils/razorpay'

const bodySchema = z.object({ orderId: z.string().min(1), paymentId: z.string().min(1), signature: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can verify billing.' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId), columns: { providerSubscriptionId: true, billingPeriod: true } })
  if (!organization?.providerSubscriptionId || organization.providerSubscriptionId !== body.orderId) throw createError({ statusCode: 400, statusMessage: 'Unknown Razorpay order.' })
  if (!verifyRazorpayPaymentSignature(body.orderId, body.paymentId, body.signature)) throw createError({ statusCode: 400, statusMessage: 'Razorpay payment verification failed.' })
  const startedAt = new Date()
  const endsAt = new Date(startedAt)
  endsAt.setMonth(endsAt.getMonth() + (organization.billingPeriod === 'annual' ? 12 : 1))
  await db.update(tables.organizations).set({ subscriptionStatus: 'active', subscriptionStartedAt: startedAt, subscriptionEndsAt: endsAt, updatedAt: startedAt }).where(eq(tables.organizations.id, session.user.organizationId))
  return { verified: true, subscriptionEndsAt: endsAt }
})
