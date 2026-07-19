import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDojoAccessible } from '../../../../utils/permissions'
import { writeAuditLog } from '../../../../utils/audit'

const createPaymentSchema = z.object({
  amount: z.number().int().positive(),
  discountAmount: z.number().int().nonnegative().default(0),
  paymentDate: z.string(),
  billingPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Select the month in which the fee period begins'),
  method: z.enum(['cash', 'bank_transfer', 'card', 'other']).default('cash'),
  referenceNumber: z.string().optional().nullable(),
  assignmentId: z.number().int().positive().nullable().optional(),
  notes: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify student
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }
  if (student.dojoId ? !await isDojoAccessible(session.user.id, orgId, student.dojoId) : session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const body = await readValidatedBody(event, createPaymentSchema.parse)

  // If assignmentId provided, verify it belongs to the student
  if (body.assignmentId) {
    const assignment = await db.query.studentFeeAssignments.findFirst({
      where: and(
        eq(tables.studentFeeAssignments.id, body.assignmentId),
        eq(tables.studentFeeAssignments.studentId, Number(studentId))
      ),
    })
    if (!assignment) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid fee assignment' })
    }
  }

  // Generate a unique receipt number (e.g., RCP-YYYYMMDD-XXXX)
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const random = randomUUID().slice(0, 8).toUpperCase()
  const receiptNumber = `RCP-${dateStr}-${random}`

  const [payment] = await db.insert(tables.payments).values({
    studentId: Number(studentId),
    amount: body.amount,
    discountAmount: body.discountAmount,
    paymentDate: new Date(body.paymentDate),
    billingPeriod: body.billingPeriod,
    method: body.method,
    referenceNumber: body.referenceNumber || null,
    receiptNumber,
    notes: body.notes || null,
    assignmentId: body.assignmentId || null,
  }).returning() as any[]

  if (!payment) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to record payment' })
  }
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: session.user.id,
    action: 'payment.recorded',
    entityType: 'payment',
    entityId: payment.id,
    targetLabel: `${student.firstName} ${student.lastName}`,
    scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
    details: `₹${(body.amount / 100).toFixed(2)} | ${body.billingPeriod} | ${payment.receiptNumber}`,
  })

  return { success: true, payment }
})
