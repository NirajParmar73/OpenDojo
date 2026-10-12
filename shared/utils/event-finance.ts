import type { BookingStatus, EventAttendee, EventPrices } from '../types/events'

export const reservingStatuses: BookingStatus[] = ['provisional', 'pending', 'confirmed']

export function attendeeRequestsTransport(person: Pick<EventAttendee, 'transportOut' | 'transportReturn' | 'busOut' | 'busReturn'>) {
  return person.transportOut || person.transportReturn || Boolean(person.busOut?.trim() || person.busReturn?.trim())
}

export function eventCharge(attendees: Pick<EventAttendee, 'type' | 'transportOut' | 'transportReturn' | 'accommodation' | 'underFive'>[], prices: EventPrices, discount = 0) {
  const subtotal = attendees.reduce((sum, person) => {
    if (person.type === 'parent' && person.underFive) return sum
    return sum + prices[person.type]
      + (person.transportOut ? prices.transportOut : 0)
      + (person.transportReturn ? prices.transportReturn : 0)
      + (person.accommodation ? prices.accommodation : 0)
  }, 0)
  const net = Math.max(0, subtotal - discount)
  const tax = Math.round(net * prices.taxBps / 10000)
  return { subtotal, discount, net, tax, total: net + tax }
}

export function bookingCharge(booking: { status: string, attendees: EventAttendee[], prices: EventPrices, discount: number, cancellationFee: number }) {
  if (booking.status === 'waitlisted') return { subtotal: 0, discount: 0, net: 0, tax: 0, total: 0 }
  if (booking.status === 'cancelled') {
    const tax = Math.round(booking.cancellationFee * booking.prices.taxBps / 10000)
    return { subtotal: booking.cancellationFee, discount: 0, net: booking.cancellationFee, tax, total: booking.cancellationFee + tax }
  }
  return eventCharge(booking.attendees, booking.prices, booking.discount)
}

export function bookingBalance(booking: Parameters<typeof bookingCharge>[0] & { id: number }, ledger: { bookingId: number | null, kind: string, amount: number }[]) {
  const rows = ledger.filter(row => row.bookingId === booking.id)
  const collected = rows.filter(row => row.kind === 'payment').reduce((sum, row) => sum + row.amount, 0)
  const refunded = rows.filter(row => row.kind === 'refund').reduce((sum, row) => sum + row.amount, 0)
  const charge = bookingCharge(booking)
  const paid = collected - refunded
  return { ...charge, collected, refunded, paid, outstanding: Math.max(0, charge.total - paid), credit: Math.max(0, paid - charge.total) }
}
export function bookingPaymentStatus(booking: Parameters<typeof bookingCharge>[0] & { id: number }, ledger: { bookingId: number | null, kind: string, amount: number }[]) {
  if (booking.status === 'waitlisted') return 'waitlisted'
  const balance = bookingBalance(booking, ledger)
  if (balance.credit > 0) return 'credit_due'
  if (balance.total === 0) return 'no_fee'
  if (balance.outstanding === 0) return 'paid'
  return balance.paid > 0 ? 'part_paid' : 'pending'
}

export function eventOccupancy(bookings: { status: string, attendees: EventAttendee[] }[]) {
  const people = bookings.filter(booking => reservingStatuses.includes(booking.status as BookingStatus)).flatMap(booking => booking.attendees)
  return {
    people: people.length,
    students: people.filter(person => person.type === 'student').length,
    parents: people.filter(person => person.type === 'parent').length,
    beds: people.filter(person => person.accommodation).length,
    outbound: people.filter(person => person.transportOut).length,
    returning: people.filter(person => person.transportReturn).length,
    checkedIn: people.filter(person => person.checkedInAt).length,
  }
}

export function capacityProblem(occupancy: ReturnType<typeof eventOccupancy>, capacity: { capacity: number, bedCapacity: number, outboundCapacity: number, returnCapacity: number }) {
  if (capacity.capacity && occupancy.people > capacity.capacity) return 'Attendee capacity is full'
  if (capacity.bedCapacity && occupancy.beds > capacity.bedCapacity) return 'Accommodation capacity is full'
  if (capacity.outboundCapacity && occupancy.outbound > capacity.outboundCapacity) return 'Outward transport is full'
  if (capacity.returnCapacity && occupancy.returning > capacity.returnCapacity) return 'Return transport is full'
  return null
}

export function bookingMissingDetails(booking: { attendees: EventAttendee[], contactName: string, contactPhone: string, registrationForm?: { includesMeals: boolean } | null, consent: { accepted: boolean, name: string, phone: string } }) {
  const missing: string[] = []
  if (!booking.contactName.trim() || !booking.contactPhone.trim()) missing.push('Booking contact')
  if (booking.attendees.some(person => !person.name.trim())) missing.push('Attendee names')
  if (booking.attendees.some(person => person.type === 'parent' && !person.relationship.trim())) missing.push('Accompanying person relationships')
  if (booking.registrationForm?.includesMeals !== false && booking.attendees.some(person => !person.meal.trim())) missing.push('Meal preferences')
  if (!booking.consent.accepted || !booking.consent.name.trim() || !booking.consent.phone.trim()) missing.push('Consent')
  return missing
}

export function eventFinancials(
  event: { fixedBudget: number, perPersonBudget: number, overheadBudget: number },
  bookings: (Parameters<typeof bookingCharge>[0] & { id: number })[],
  costs: { id: number, amount: number, tax: number, category: string, status: string }[],
  ledger: { bookingId: number | null, costId: number | null, kind: string, amount: number, tax: number }[],
) {
  const balances = bookings.map(booking => bookingBalance(booking, ledger))
  const sum = (kind: string) => ledger.filter(row => row.kind === kind).reduce((total, row) => total + row.amount, 0)
  const incomeNet = ledger.filter(row => row.kind === 'income' || row.kind === 'income_refund').reduce((total, row) => total + (row.kind === 'income' ? 1 : -1) * (row.amount - row.tax), 0)
  const activeCosts = costs.filter(cost => cost.status !== 'cancelled')
  // Supplier tax is treated as a cost; input-tax credits are not assumed.
  const directCosts = activeCosts.filter(cost => cost.category === 'direct').reduce((total, cost) => total + cost.amount + cost.tax, 0)
  const overheadCosts = activeCosts.filter(cost => cost.category === 'overhead').reduce((total, cost) => total + cost.amount + cost.tax, 0)
  const bookingRevenue = balances.reduce((total, row) => total + row.net, 0)
  const revenue = bookingRevenue + incomeNet
  const grossProfit = revenue - directCosts
  const netProfit = grossProfit - overheadCosts
  const costPaid = sum('cost_payment') - sum('cost_refund')
  const people = eventOccupancy(bookings).people
  const budgetDirect = event.fixedBudget + people * event.perPersonBudget
  const budgetTotal = budgetDirect + event.overheadBudget
  const averageRevenue = people ? bookingRevenue / people : 0
  const contribution = averageRevenue - event.perPersonBudget
  return {
    revenue, bookingRevenue, otherIncome: incomeNet,
    grossCollections: sum('payment'), refunds: sum('refund'), collected: sum('payment') - sum('refund'),
    outstanding: balances.reduce((total, row) => total + row.outstanding, 0),
    refundDue: balances.reduce((total, row) => total + row.credit, 0),
    outputTax: balances.reduce((total, row) => total + row.tax, 0) + ledger.filter(row => row.kind === 'income' || row.kind === 'income_refund').reduce((total, row) => total + (row.kind === 'income' ? 1 : -1) * row.tax, 0),
    directCosts, overheadCosts, grossProfit, netProfit, costPaid,
    supplierDue: activeCosts.reduce((total, cost) => {
      const paid = ledger.filter(row => row.costId === cost.id).reduce((n, row) => n + (row.kind === 'cost_payment' ? row.amount : row.kind === 'cost_refund' ? -row.amount : 0), 0)
      return total + Math.max(0, cost.amount + cost.tax - paid)
    }, 0),
    cashSurplus: sum('payment') - sum('refund') + sum('income') - sum('income_refund') - costPaid,
    budgetDirect, budgetTotal, budgetVariance: budgetTotal - directCosts - overheadCosts,
    forecastProfit: revenue - Math.max(budgetDirect, directCosts) - Math.max(event.overheadBudget, overheadCosts),
    margin: revenue ? netProfit / revenue * 100 : 0,
    breakEvenAttendees: contribution > 0 ? Math.ceil(Math.max(0, event.fixedBudget + event.overheadBudget - incomeNet) / contribution) : null,
  }
}
