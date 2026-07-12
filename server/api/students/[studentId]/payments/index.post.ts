import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

const createPaymentSchema = z.object({
  amount: z.number().int().positive(),
  paymentDate: z.string(),
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

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
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
    paymentDate: new Date(body.paymentDate),
    method: body.method,
    referenceNumber: body.referenceNumber || null,
    receiptNumber,
    notes: body.notes || null,
    assignmentId: body.assignmentId || null,
  }).returning() as any[]

  if (!payment) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to record payment' })
  }

  return { success: true, payment }
})