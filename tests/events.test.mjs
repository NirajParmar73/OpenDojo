import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(fs.readFileSync('shared/utils/event-finance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { eventCharge, bookingBalance, eventOccupancy, capacityProblem, bookingMissingDetails, eventFinancials } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const prices = { student: 1700000, parent: 1200000, transportOut: 50000, transportReturn: 50000, accommodation: 0, taxBps: 500 }
const person = (type = 'student', changes = {}) => ({ id: 'p', type, name: 'Attendee', relationship: type === 'parent' ? 'Mother' : '', meal: 'Jain', accommodation: true, transportOut: true, transportReturn: false, checkedInAt: null, ...changes })
const booking = (changes = {}) => ({ id: 1, status: 'pending', attendees: [person(), person('parent')], prices, discount: 0, cancellationFee: 0, contactName: 'Parent', contactPhone: '1234567890', consent: { accepted: true, name: 'Parent', phone: '1234567890' }, ...changes })

test('family pricing charges each attendee and each selected travel direction once', () => {
  assert.deepEqual(eventCharge([person(), person('parent'), person('parent', { transportReturn: true })], prices, 100000), { subtotal: 4300000, discount: 100000, net: 4200000, tax: 210000, total: 4410000 })
})
test('installments and partial refunds preserve collections and outstanding balances', () => {
  const result = bookingBalance(booking(), [{ bookingId: 1, kind: 'payment', amount: 1000000 }, { bookingId: 1, kind: 'payment', amount: 500000 }, { bookingId: 1, kind: 'refund', amount: 200000 }, { bookingId: 2, kind: 'payment', amount: 9000000 }])
  assert.equal(result.total, 3150000)
  assert.equal(result.collected, 1500000)
  assert.equal(result.refunded, 200000)
  assert.equal(result.outstanding, 1850000)
})
test('cancellation retains an explicit fee and reports refund liability', () => {
  const result = bookingBalance(booking({ status: 'cancelled', cancellationFee: 100000 }), [{ bookingId: 1, kind: 'payment', amount: 3150000 }])
  assert.equal(result.total, 105000)
  assert.equal(result.credit, 3045000)
  assert.equal(result.outstanding, 0)
})
test('provisional parents reserve places; waiting list and cancelled bookings do not', () => {
  const occupancy = eventOccupancy([booking({ status: 'provisional' }), booking({ status: 'waitlisted' }), booking({ status: 'cancelled' })])
  assert.equal(occupancy.people, 2)
  assert.equal(occupancy.beds, 2)
  assert.equal(occupancy.outbound, 2)
  assert.equal(capacityProblem(occupancy, { capacity: 2, bedCapacity: 1, outboundCapacity: 0, returnCapacity: 0 }), 'Accommodation capacity is full')
  assert.equal(capacityProblem(occupancy, { capacity: 2, bedCapacity: 2, outboundCapacity: 2, returnCapacity: 0 }), null)
  assert.equal(bookingBalance(booking({ status: 'waitlisted' }), []).total, 0)
})
test('unnamed parents and incomplete consent prevent confirmation', () => {
  const missing = bookingMissingDetails(booking({ attendees: [person(), person('parent', { name: '', relationship: '', meal: '' })], consent: { accepted: false, name: '', phone: '' } }))
  assert.deepEqual(missing, ['Attendee names', 'Accompanying person relationships', 'Meal preferences', 'Consent'])
})
test('profit includes unpaid supplier costs while cash includes actual settlements', () => {
  const result = eventFinancials({ fixedBudget: 1000000, perPersonBudget: 200000, overheadBudget: 100000 }, [booking()], [{ id: 1, amount: 1000000, tax: 100000, category: 'direct', status: 'committed' }, { id: 2, amount: 100000, tax: 0, category: 'overhead', status: 'incurred' }], [{ bookingId: 1, costId: null, kind: 'payment', amount: 500000, tax: 0 }, { bookingId: null, costId: 1, kind: 'cost_payment', amount: 200000, tax: 0 }])
  assert.equal(result.revenue, 3000000)
  assert.equal(result.grossProfit, 1900000)
  assert.equal(result.netProfit, 1800000)
  assert.equal(result.cashSurplus, 300000)
  assert.equal(result.supplierDue, 1000000)
  assert.equal(result.forecastProfit, 1500000)
  assert.equal(result.outstanding, 2650000)
})
test('other income and refunds separate tax from revenue and cash', () => {
  const result = eventFinancials({ fixedBudget: 0, perPersonBudget: 0, overheadBudget: 0 }, [], [], [{ bookingId: null, costId: null, kind: 'income', amount: 110000, tax: 10000 }, { bookingId: null, costId: null, kind: 'income_refund', amount: 55000, tax: 5000 }])
  assert.equal(result.revenue, 50000)
  assert.equal(result.cashSurplus, 55000)
  assert.equal(result.outputTax, 5000)
  assert.equal(result.breakEvenAttendees, null)
})
