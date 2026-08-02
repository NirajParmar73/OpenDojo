type FeeFrequency = 'monthly' | 'quarterly' | 'half-annually' | 'annual' | 'one-time' | null

interface LedgerPayment {
  id: number
  amount: number
  tuitionAmount?: number | null
  discountAmount?: number | null
  paymentDate: Date | number
  billingPeriod?: string | null
  receiptNumber: string
  refunds?: Array<{ tuitionAmount?: number | null, status?: string | null }>
}

interface FeeLedgerInput {
  amount: number
  discount?: number | null
  frequency: FeeFrequency
  startDate: Date | number
  endDate?: Date | number | null
  dueDay?: number | null
  payments?: LedgerPayment[]
}

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/

function asDate(value: Date | number) {
  return value instanceof Date ? value : new Date(value)
}

function monthKey(year: number, monthIndex: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function dateMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function parseMonth(value: string) {
  return { year: Number(value.slice(0, 4)), monthIndex: Number(value.slice(5, 7)) - 1 }
}

function monthDifference(start: Date, end: Date) {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
}

function periodDate(key: string, dueDay: number, minimum?: Date) {
  const { year, monthIndex } = parseMonth(key)
  const date = new Date(Date.UTC(year, monthIndex, Math.min(Math.max(dueDay, 1), 28)))
  return minimum && date < minimum ? minimum : date
}

export function feePeriodLabel(key: string, frequency: FeeFrequency) {
  const { year, monthIndex } = parseMonth(key)
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const label = (date: Date) => date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  if (frequency === 'one-time') return `One-time · ${label(start)}`
  const months = frequency === 'quarterly' ? 3 : frequency === 'half-annually' ? 6 : frequency === 'annual' ? 12 : 1
  if (months === 1) return label(start)
  const end = new Date(Date.UTC(year, monthIndex + months - 1, 1))
  return `${label(start)} – ${label(end)}`
}

export function buildFeePeriodLedger(input: FeeLedgerInput, referenceDate = new Date()) {
  const startDate = asDate(input.startDate)
  const endDate = input.endDate ? asDate(input.endDate) : null
  const effectiveEnd = endDate && endDate < referenceDate ? endDate : referenceDate
  const dueDay = input.dueDay || startDate.getUTCDate() || 1
  const frequency = input.frequency || 'monthly'
  const monthsPerPeriod = frequency === 'quarterly' ? 3 : frequency === 'half-annually' ? 6 : frequency === 'annual' ? 12 : 1
  const netAmount = Math.max(0, input.amount - (input.discount || 0))
  const periods = new Map<string, { key: string, dueDate: Date, scheduled: boolean, payments: Array<LedgerPayment & { tuitionPaid: number, creditedAmount: number }> }>()

  const duePeriods = startDate <= effectiveEnd
    ? frequency === 'one-time' ? 1 : Math.floor(monthDifference(startDate, effectiveEnd) / monthsPerPeriod) + 1
    : 0
  // A corrupt or centuries-old date must not create an unbounded response.
  const boundedDuePeriods = Math.min(duePeriods, 240)
  for (let index = 0; index < boundedDuePeriods; index++) {
    const key = monthKey(startDate.getUTCFullYear(), startDate.getUTCMonth() + index * monthsPerPeriod)
    periods.set(key, { key, dueDate: periodDate(key, dueDay, index === 0 ? startDate : undefined), scheduled: true, payments: [] })
  }

  for (const payment of input.payments || []) {
    const paymentDate = asDate(payment.paymentDate)
    const key = payment.billingPeriod && periodPattern.test(payment.billingPeriod)
      ? payment.billingPeriod
      : dateMonthKey(paymentDate)
    const entry = periods.get(key) || { key, dueDate: periodDate(key, dueDay), scheduled: false, payments: [] }
    const refundedTuition = (payment.refunds || [])
      .filter(refund => !refund.status || refund.status === 'completed')
      .reduce((sum, refund) => sum + (refund.tuitionAmount || 0), 0)
    const tuitionPaid = Math.max(0, (payment.tuitionAmount ?? payment.amount) - refundedTuition)
    entry.payments.push({ ...payment, tuitionPaid, creditedAmount: tuitionPaid + (payment.discountAmount || 0) })
    periods.set(key, entry)
  }

  let runningBalance = 0
  const rows = [...periods.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((period) => {
      const paidAmount = period.payments.reduce((sum, payment) => sum + payment.tuitionPaid, 0)
      const creditedAmount = period.payments.reduce((sum, payment) => sum + payment.creditedAmount, 0)
      const outstandingAmount = Math.max(0, netAmount - creditedAmount)
      const creditAmount = Math.max(0, creditedAmount - netAmount)
      const paidInAdvance = creditedAmount >= netAmount && period.payments.some(payment => asDate(payment.paymentDate) < period.dueDate)
      runningBalance += netAmount - creditedAmount
      const status = creditedAmount >= netAmount
        ? paidInAdvance ? 'paid_in_advance' : 'paid'
        : creditedAmount > 0
          ? 'partially_paid'
          : period.dueDate < referenceDate ? 'overdue' : 'due'
      return {
        key: period.key,
        label: feePeriodLabel(period.key, frequency),
        dueDate: period.dueDate,
        scheduled: period.scheduled,
        amountDue: netAmount,
        paidAmount,
        creditedAmount,
        outstandingAmount,
        creditAmount,
        runningBalance,
        status,
        payments: period.payments.map(payment => ({
          id: payment.id,
          receiptNumber: payment.receiptNumber,
          paymentDate: payment.paymentDate,
          paidAmount: payment.tuitionPaid,
        })),
      }
    })

  const firstUnpaid = rows.find(period => period.scheduled && period.outstandingAmount > 0) || null
  return {
    periods: rows.reverse(),
    firstUnpaidPeriod: firstUnpaid?.key || null,
    firstUnpaidLabel: firstUnpaid?.label || null,
    creditAmount: Math.max(0, -runningBalance),
  }
}
