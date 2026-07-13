export type FeeFrequency = 'monthly' | 'quarterly' | 'annual' | 'one-time'

export interface FeeBalanceInput {
  amount: number
  discount?: number | null
  frequency: FeeFrequency | null
  startDate: Date | number
  endDate?: Date | number | null
  dueDay?: number | null
  payments?: Array<{ amount: number }>
}

function asDate(value: Date | number) {
  return value instanceof Date ? value : new Date(value)
}

function addMonths(date: Date, months: number, dueDay: number) {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1)
  next.setDate(Math.min(Math.max(dueDay, 1), 28))
  return next
}

function monthDifference(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
}

export function calculateFeeBalance(input: FeeBalanceInput, referenceDate = new Date()) {
  const startDate = asDate(input.startDate)
  const endDate = input.endDate ? asDate(input.endDate) : null
  const effectiveEnd = endDate && endDate < referenceDate ? endDate : referenceDate
  const dueDay = input.dueDay || startDate.getDate() || 1
  const frequency = input.frequency || 'monthly'
  const monthsPerPeriod = frequency === 'quarterly' ? 3 : frequency === 'annual' ? 12 : 1

  let periodsDue = 0
  if (startDate <= effectiveEnd) {
    periodsDue = frequency === 'one-time'
      ? 1
      : Math.floor(monthDifference(startDate, effectiveEnd) / monthsPerPeriod) + 1
  }

  const netAmountPerPeriod = Math.max(0, input.amount - (input.discount || 0))
  const expectedAmount = netAmountPerPeriod * periodsDue
  const paidAmount = (input.payments || []).reduce((sum, payment) => sum + payment.amount, 0)
  const outstandingAmount = Math.max(0, expectedAmount - paidAmount)
  const paidPeriods = netAmountPerPeriod > 0
    ? Math.min(periodsDue, Math.floor(paidAmount / netAmountPerPeriod))
    : periodsDue
  const pendingPeriods = Math.max(0, periodsDue - paidPeriods)
  const lastDueDate = periodsDue > 0
    ? (frequency === 'one-time' ? startDate : addMonths(startDate, (periodsDue - 1) * monthsPerPeriod, dueDay))
    : null
  const nextDueDate = frequency === 'one-time'
    ? null
    : addMonths(startDate, periodsDue * monthsPerPeriod, dueDay)
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const overdue = outstandingAmount > 0 && !!lastDueDate && lastDueDate < today

  return {
    periodsDue,
    netAmountPerPeriod,
    expectedAmount,
    paidAmount,
    outstandingAmount,
    paidPeriods,
    pendingPeriods,
    lastDueDate,
    nextDueDate,
    overdue,
  }
}
