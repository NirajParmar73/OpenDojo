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
    .filter(assignment => assignment.student?.organizationId === organizationId && assignment.student.status !== 'archived' && assignment.status === 'active' && (accessibleDojoIds === null || (assignment.student.dojoId !== null && accessibleDojoIds.includes(assignment.student.dojoId))) && (!selectedDojoId || assignment.student.dojoId === selectedDojoId))
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
  const scopedExpenses = expenses.filter(expense => {
    if (expense.status !== 'paid') return false
    // A dojo filter is intentionally strict: shared organization or hierarchy
    // costs cannot be accurately assigned to one dojo without an allocation rule.
    if (selectedDojoId) return expense.scopeType === 'dojo' && expense.scopeId === selectedDojoId
    if (expense.scopeType === 'organization') return accessibleDojoIds === null
    if (expense.scopeType === 'dojo') return accessibleDojoIds === null || accessibleDojoIds.includes(expense.scopeId!)
    return accessibleDojoIds === null || managementScope.managedParentNodeIds.includes(expense.scopeId!)
  })
  const paidExpenses = scopedExpenses.reduce((sum, expense) => sum + expense.amount + expense.taxAmount, 0)
  const allDojos = await db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, organizationId) })
  const scopedDojos = allDojos.filter(dojo => (accessibleDojoIds === null || accessibleDojoIds.includes(dojo.id)) && (!selectedDojoId || dojo.id === selectedDojoId))
  const revenueByDojo = new Map<number, number>()
  for (const payment of organizationPayments) {
    const dojoId = payment.student?.dojoId
    if (dojoId) revenueByDojo.set(dojoId, (revenueByDojo.get(dojoId) || 0) + payment.amount)
  }
  const expensesByDojo = new Map<number, number>()
  for (const expense of scopedExpenses) {
    if (expense.scopeType === 'dojo' && expense.scopeId) {
      const amount = expense.amount + expense.taxAmount
      expensesByDojo.set(expense.scopeId, (expensesByDojo.get(expense.scopeId) || 0) + amount)
    }
  }
  const dojoBreakdown = scopedDojos
    .map(dojo => {
      const revenue = revenueByDojo.get(dojo.id) || 0
      const paidExpenses = expensesByDojo.get(dojo.id) || 0
      return { dojoId: dojo.id, dojoName: dojo.name, revenue, paidExpenses, netRevenue: revenue - paidExpenses }
    })
    .sort((a, b) => b.netRevenue - a.netRevenue || a.dojoName.localeCompare(b.dojoName))
  const directDojoExpenses = dojoBreakdown.reduce((sum, dojo) => sum + dojo.paidExpenses, 0)
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
      sharedExpenses: paidExpenses - directDojoExpenses,
      paymentCount: organizationPayments.length,
    },
    records,
    paymentMethods,
    revenueTrend,
    dojoBreakdown,
  }
})
