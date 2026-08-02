import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../../utils/permissions'
import { calculateFeeBalance } from '../../../../utils/fees'
import { buildFeePeriodLedger } from '../../../../utils/fee-ledger'

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

  // Fetch assignments with relations
  const assignments = await db.query.studentFeeAssignments.findMany({
    where: eq(tables.studentFeeAssignments.studentId, Number(studentId)),
    with: {
      feePlan: {
        with: { dojo: true },
      },
      payments: { with: { refunds: true } },
    },
    orderBy: (a, { desc }) => [desc(a.startDate)],
  }) as any[] // cast to any

  const assignmentsWithBalance = assignments.map(assignment => {
    const balance = calculateFeeBalance({
      amount: assignment.feePlan.amount,
      discount: assignment.discount,
      frequency: assignment.feePlan.frequency,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      dueDay: assignment.dueDay,
      payments: assignment.payments,
    })
    const ledger = buildFeePeriodLedger({
      amount: assignment.feePlan.amount,
      discount: assignment.discount,
      frequency: assignment.feePlan.frequency,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      dueDay: assignment.dueDay,
      payments: assignment.payments,
    })
    return {
      ...assignment,
      outstanding: balance.outstandingAmount,
      netAmount: balance.netAmountPerPeriod,
      ledger,
    }
  })

  return assignmentsWithBalance
})
