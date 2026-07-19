type FeeFrequency = 'monthly' | 'quarterly' | 'annual' | 'one-time' | null | undefined
type MonthFormat = 'long' | 'short'

export function formatFeePeriod(billingPeriod: string | null, paymentDate: Date | number, frequency: FeeFrequency, monthFormat: MonthFormat = 'long') {
  const start = billingPeriod ? new Date(`${billingPeriod}-01T00:00:00`) : new Date(paymentDate)
  const monthLabel = (date: Date) => date.toLocaleDateString('en-IN', { month: monthFormat, year: 'numeric' })
  if (frequency === 'one-time') return `One-time · ${monthLabel(start)}`

  const months = frequency === 'quarterly' ? 3 : frequency === 'annual' ? 12 : 1
  if (months === 1) return monthLabel(start)

  const end = new Date(start)
  end.setMonth(end.getMonth() + months - 1)
  return `${monthLabel(start)} – ${monthLabel(end)}`
}
