import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'
import { hasFinanceManagementAccess } from '../../../utils/permissions'
import { reconcileStudentFeeNotifications } from '../../../utils/student-notifications'

const updateBillingPeriodSchema = z.object({
  billingPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a valid fee period'),
  reason: z.string().trim().min(3, 'Give a brief reason for this correction').max(500),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const paymentId = Number(getRouterParam(event, 'id'))
  if (!paymentId) throw createError({ statusCode: 400, statusMessage: 'Invalid payment' })
  const body = await readValidatedBody(event, updateBillingPeriodSchema.parse)

  const payment = await db.query.payments.findFirst({
    where: eq(tables.payments.id, paymentId),
    with: { student: true, assignment: { with: { feePlan: true } } },
  })
  if (!payment || payment.student.organizationId !== organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  }
  if (!await hasFinanceManagementAccess(session.user.id, organizationId, payment.student.dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'Fee-period corrections require finance management access for this location' })
  }
  if (!payment.assignment || payment.assignmentId === null) {
    throw createError({ statusCode: 409, statusMessage: 'Only payments linked to a fee assignment can have their fee period corrected' })
  }

  const assignmentStart = new Date(payment.assignment.startDate).toISOString().slice(0, 7)
  if (body.billingPeriod < assignmentStart) {
    throw createError({ statusCode: 400, statusMessage: 'Fee period cannot begin before the assignment' })
  }
  if (payment.assignment.endDate && body.billingPeriod > new Date(payment.assignment.endDate).toISOString().slice(0, 7)) {
    throw createError({ statusCode: 400, statusMessage: 'Fee period cannot begin after the assignment ended' })
  }
  const monthNumber = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1
  const frequency = payment.assignment.feePlan.frequency
  const monthsPerPeriod = frequency === 'quarterly' ? 3 : frequency === 'half-annually' ? 6 : frequency === 'annual' ? 12 : frequency === 'one-time' ? 0 : 1
  const offsetFromStart = monthNumber(body.billingPeriod) - monthNumber(assignmentStart)
  if ((monthsPerPeriod === 0 && offsetFromStart !== 0) || (monthsPerPeriod > 1 && offsetFromStart % monthsPerPeriod !== 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Fee period does not align with this fee plan schedule' })
  }
  const futureLimit = new Date()
  futureLimit.setUTCMonth(futureLimit.getUTCMonth() + 24)
  const maximumPeriod = futureLimit.toISOString().slice(0, 7)
  if (body.billingPeriod > maximumPeriod) {
    throw createError({ statusCode: 400, statusMessage: 'Fee period cannot be more than 24 months in the future' })
  }

  const previousPeriod = payment.billingPeriod
  if (previousPeriod === body.billingPeriod) return { success: true, payment }
  const [updated] = await db.update(tables.payments)
    .set({ billingPeriod: body.billingPeriod, updatedAt: new Date() })
    .where(eq(tables.payments.id, paymentId))
    .returning()
  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Failed to correct fee period' })

  await writeAuditLog({
    organizationId,
    actorUserId: session.user.id,
    action: 'payment.billing_period_corrected',
    entityType: 'payment',
    entityId: payment.id,
    targetLabel: `${payment.student.firstName} ${payment.student.lastName}`,
    scope: payment.student.dojoId ? { type: 'dojo', id: payment.student.dojoId } : { type: 'organization' },
    details: `${payment.receiptNumber} | ${previousPeriod || 'not set'} → ${body.billingPeriod} | ${body.reason}`,
  })
  await reconcileStudentFeeNotifications(payment.studentId, organizationId).catch(error => console.error('Could not reconcile student fee notifications after billing-period correction.', error))

  return { success: true, payment: updated }
})
