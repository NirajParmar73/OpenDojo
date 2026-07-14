import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { calculateFeeBalance } from '../../utils/fees'
import { getAccessibleDojoIds, getHierarchyManagementScope } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const organizationId = session.user.organizationId
  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }
  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, organizationId)
  const managementScope = await getHierarchyManagementScope(session.user.id, organizationId)
  const selectedDojoId = Number(getQuery(event).dojoId) || null
  if (selectedDojoId && accessibleDojoIds !== null && !accessibleDojoIds.includes(selectedDojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'Report scope is not accessible' })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const assignments = await db.query.studentFeeAssignments.findMany({
    with: {
      student: { with: { dojo: true } },
      feePlan: true,
      payments: true,
    },
  }) as any[]

  const records = assignments
    .filter(assignment => assignment.student?.organizationId === organizationId && assignment.status === 'active' && (accessibleDojoIds === null || (assignment.student.dojoId !== null && accessibleDojoIds.includes(assignment.student.dojoId))) && (!selectedDojoId || assignment.student.dojoId === selectedDojoId))
    .map((assignment) => {
      const balance = calculateFeeBalance({
        amount: assignment.feePlan.amount,
        discount: assignment.discount,
        frequency: assignment.feePlan.frequency,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        dueDay: assignment.dueDay,
        payments: assignment.payments,
      })
      const monthsPerPeriod = assignment.feePlan.frequency === 'quarterly' ? 3 : assignment.feePlan.frequency === 'annual' ? 12 : 1
      const firstUnpaidDueDate = balance.pendingPeriods && balance.paidPeriods < balance.periodsDue
        ? new Date(
            new Date(assignment.startDate).getFullYear(),
            new Date(assignment.startDate).getMonth() + (balance.paidPeriods * monthsPerPeriod),
            Math.min(Math.max(assignment.dueDay || new Date(assignment.startDate).getDate() || 1, 1), 28),
          )
        : null
      const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const daysOverdue = firstUnpaidDueDate && firstUnpaidDueDate < todayAtMidnight
        ? Math.floor((todayAtMidnight.getTime() - firstUnpaidDueDate.getTime()) / 86_400_000)
        : 0
      return {
        assignmentId: assignment.id,
        studentId: assignment.student.id,
        studentName: `${assignment.student.firstName} ${assignment.student.lastName}`,
        studentStatus: assignment.student.status,
        dojoName: assignment.student.dojo?.name || 'Unassigned',
        feePlanName: assignment.feePlan.name,
        frequency: assignment.feePlan.frequency,
        firstUnpaidDueDate,
        daysOverdue,
        paidThisMonth: assignment.payments.reduce((sum: number, payment: any) => {
          const paymentDate = new Date(payment.paymentDate)
          return paymentDate >= monthStart && paymentDate < nextMonthStart ? sum + payment.amount : sum
        }, 0),
        ...balance,
        collectionStatus: balance.outstandingAmount === 0 ? 'paid' : balance.overdue ? 'overdue' : 'pending',
      }
    })
    .sort((a, b) => {
      const order = { overdue: 0, pending: 1, paid: 2 }
      return order[a.collectionStatus] - order[b.collectionStatus] || b.outstandingAmount - a.outstandingAmount
    })

  const payments = await db.query.payments.findMany({
    with: { student: true },
  }) as any[]
  const organizationPayments = payments.filter(payment => payment.student?.organizationId === organizationId && (accessibleDojoIds === null || (payment.student.dojoId !== null && accessibleDojoIds.includes(payment.student.dojoId))) && (!selectedDojoId || payment.student.dojoId === selectedDojoId))
  const expenses = await db.query.expenses.findMany({ where: eq(tables.expenses.organizationId, organizationId) })
  const scopedExpenses = expenses.filter(expense => expense.status === 'paid' && (
    expense.scopeType === 'organization'
      ? accessibleDojoIds === null && selectedDojoId === null
      : expense.scopeType === 'dojo'
        ? (!selectedDojoId || expense.scopeId === selectedDojoId) && (accessibleDojoIds === null || accessibleDojoIds.includes(expense.scopeId!))
        : accessibleDojoIds === null || managementScope.managedParentNodeIds.includes(expense.scopeId!)
  ))
  const paidExpenses = scopedExpenses.reduce((sum, expense) => sum + expense.amount + expense.taxAmount, 0)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const collectedThisMonth = organizationPayments
    .filter(payment => new Date(payment.paymentDate) >= monthStart && new Date(payment.paymentDate) < nextMonthStart)
    .reduce((sum, payment) => sum + payment.amount, 0)
  const collectedPreviousMonth = organizationPayments
    .filter(payment => new Date(payment.paymentDate) >= previousMonthStart && new Date(payment.paymentDate) < monthStart)
    .reduce((sum, payment) => sum + payment.amount, 0)

  const paymentMethods = Object.entries(organizationPayments.reduce((result: Record<string, number>, payment) => {
    result[payment.method || 'other'] = (result[payment.method || 'other'] || 0) + payment.amount
    return result
  }, {})).map(([method, amount]) => ({ method, amount }))

  const revenueTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const nextDate = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    const amount = organizationPayments
      .filter(payment => new Date(payment.paymentDate) >= date && new Date(payment.paymentDate) < nextDate)
      .reduce((sum, payment) => sum + payment.amount, 0)
    return {
      label: date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      amount,
    }
  })

  return {
    summary: {
      outstandingAmount: records.reduce((sum, record) => sum + record.outstandingAmount, 0),
      overdueAmount: records.filter(record => record.overdue).reduce((sum, record) => sum + record.outstandingAmount, 0),
      pendingStudents: new Set(records.map(record => record.studentId)).size,
      overdueStudents: new Set(records.filter(record => record.overdue).map(record => record.studentId)).size,
      paidAssignments: records.filter(record => record.collectionStatus === 'paid').length,
      collectedThisMonth,
      collectedPreviousMonth,
      allTimeRevenue: organizationPayments.reduce((sum, payment) => sum + payment.amount, 0),
      paidExpenses,
      netRevenue: organizationPayments.reduce((sum, payment) => sum + payment.amount, 0) - paidExpenses,
      paymentCount: organizationPayments.length,
    },
    records,
    paymentMethods,
    revenueTrend,
  }
})
