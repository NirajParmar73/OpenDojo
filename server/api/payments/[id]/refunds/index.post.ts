import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { writeAuditLog } from '../../../../utils/audit'
import { db, tables } from '../../../../utils/database'
import { hasFinanceManagementAccess } from '../../../../utils/permissions'
import { reconcileStudentFeeNotifications } from '../../../../utils/student-notifications'

const createRefundSchema = z.object({
  amount: z.number().int().positive(),
  tuitionAmount: z.number().int().nonnegative(),
  refundedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(['cash', 'bank_transfer', 'card', 'other']),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
}).refine(body => body.tuitionAmount <= body.amount, {
  message: 'The tuition portion cannot exceed the total refund',
  path: ['tuitionAmount'],
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const user = session.user
  const organizationId = user.organizationId as number

  const paymentId = Number(getRouterParam(event, 'id'))
  if (!paymentId) throw createError({ statusCode: 400, statusMessage: 'Invalid payment' })
  const body = await readValidatedBody(event, createRefundSchema.parse)
  const refundedAt = new Date(`${body.refundedAt}T12:00:00`)
  if (Number.isNaN(refundedAt.getTime()) || body.refundedAt > new Date().toISOString().slice(0, 10)) {
    throw createError({ statusCode: 400, statusMessage: 'Refund date cannot be in the future' })
  }

  const refund = await db.transaction(async (tx) => {
    // Serialize refunds for this payment so two simultaneous requests cannot
    // together exceed the original payment.
    await tx.execute(sql`select id from payments where id = ${paymentId} for update`)
    const payment = await tx.query.payments.findFirst({
      where: eq(tables.payments.id, paymentId),
      with: { student: true, refunds: true },
    })
    if (!payment || payment.student.organizationId !== organizationId) {
      throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
    }
    if (!await hasFinanceManagementAccess(user.id, organizationId, payment.student.dojoId)) {
      throw createError({ statusCode: 403, statusMessage: 'Refunds require a finance management responsibility for this location' })
    }
    if (body.refundedAt < new Date(payment.paymentDate).toISOString().slice(0, 10)) {
      throw createError({ statusCode: 400, statusMessage: 'Refund date cannot be before the payment date' })
    }

    const completedRefunds = payment.refunds.filter(item => item.status === 'completed')
    const alreadyRefunded = completedRefunds.reduce((sum, item) => sum + item.amount, 0)
    const tuitionAlreadyRefunded = completedRefunds.reduce((sum, item) => sum + item.tuitionAmount, 0)
    const originalTuition = payment.tuitionAmount ?? payment.amount
    if (body.amount > payment.amount - alreadyRefunded) {
      throw createError({ statusCode: 409, statusMessage: 'Refund exceeds the remaining refundable payment amount' })
    }
    if (body.tuitionAmount > originalTuition - tuitionAlreadyRefunded) {
      throw createError({ statusCode: 409, statusMessage: 'Refund exceeds the remaining tuition portion' })
    }

    const datePart = body.refundedAt.replaceAll('-', '')
    const refundNumber = `REF-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`
    const [created] = await tx.insert(tables.paymentRefunds).values({
      paymentId,
      amount: body.amount,
      tuitionAmount: body.tuitionAmount,
      refundNumber,
      refundedAt,
      method: body.method,
      referenceNumber: body.referenceNumber || null,
      reason: body.reason,
      status: 'completed',
      createdBy: user.id,
    }).returning()
    return { created, payment }
  })

  if (!refund.created) throw createError({ statusCode: 500, statusMessage: 'Failed to record refund' })
  await writeAuditLog({
    organizationId,
    actorUserId: user.id,
    action: 'payment.refunded',
    entityType: 'payment_refund',
    entityId: refund.created.id,
    targetLabel: `${refund.payment.student.firstName} ${refund.payment.student.lastName}`,
    scope: refund.payment.student.dojoId ? { type: 'dojo', id: refund.payment.student.dojoId } : { type: 'organization' },
    details: `${refund.created.refundNumber} | ${(body.amount / 100).toFixed(2)} | Original receipt ${refund.payment.receiptNumber}`,
  })
  await reconcileStudentFeeNotifications(refund.payment.studentId, organizationId).catch(error => console.error('Could not reconcile student fee notifications after refund.', error))

  return { success: true, refund: refund.created }
})
