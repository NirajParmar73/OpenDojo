import { eventActor, getEventDetail } from '../../../utils/events'
import { toCsv } from '../../../utils/csv'
import { eventCharge } from '#shared/utils/event-finance'

export default defineEventHandler(async http => {
  const detail = await getEventDetail(await eventActor(http), Number(getRouterParam(http, 'id')))
  const kind = String(getQuery(http).kind || 'bookings')
  let rows: unknown[][]
  if (kind === 'bookings') {
    rows = [['Booking', 'Status', 'Fee status', 'Form / fee package', 'Students', 'Student count', 'Current grade / belt', 'Source', 'Dojo / school', 'City', 'State', 'Country', 'Instructor', 'Attendees', 'Under 5 companions', 'Contact', 'Phone', 'Currency', 'Total', 'Collected net', 'Outstanding', 'Refund due', 'Missing details', 'Custom answers'], ...detail.bookings.map(booking => [booking.reference, booking.status, booking.paymentStatus, booking.registrationForm?.name || 'General', booking.attendees.filter(person => person.type === 'student').map(person => person.name).join('; '), booking.attendees.filter(person => person.type === 'student').length, booking.attendees.filter(person => person.type === 'student').map(person => person.currentGrade || booking.guestProfile?.currentGrade || '').join('; '), detail.event.registrationMode === 'public' ? 'Event participant' : booking.guestProfile ? 'Guest' : 'Existing student', booking.guestProfile?.dojoName || '', booking.guestProfile?.city || '', booking.guestProfile?.state || '', booking.guestProfile?.country || '', booking.guestProfile?.instructorName || '', booking.attendees.length, booking.attendees.filter(person => person.type === 'parent' && person.underFive).length, booking.contactName, booking.contactPhone, detail.event.currency, booking.balance.total / 100, booking.balance.paid / 100, booking.balance.outstanding / 100, booking.balance.credit / 100, booking.missing.join('; '), JSON.stringify(booking.customAnswers)])]
  } else if (kind === 'requests') {
    if (!detail.canManage) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
    rows = [['Reference', 'Status', 'Form / fee package', 'Students', 'Student count', 'Current grade / belt', 'Source', 'Dojo / school', 'City', 'State', 'Country', 'Instructor', 'Attendees', 'Under 5 companions', 'Contact', 'Phone', 'Quoted total', 'Booking ID', 'Photos received', 'Signed copy required', 'Signed copy received at', 'Custom answers'], ...detail.registrationRequests.map(request => [request.reference, request.status, request.registrationForm?.name || 'General', request.attendees.filter(person => person.type === 'student').map(person => person.name).join('; '), request.attendees.filter(person => person.type === 'student').length, request.attendees.filter(person => person.type === 'student').map(person => person.currentGrade || request.currentGrade).join('; '), request.sourceType, request.sourceDojoName, request.sourceCity, request.sourceState, request.sourceCountry, request.instructorName, request.attendees.length, request.attendees.filter(person => person.type === 'parent' && person.underFive).length, request.contactName, request.contactPhone, eventCharge(request.attendees, request.prices).total / 100, request.bookingId, request.attendees.filter(person => person.type === 'student' && person.photoPath).length, request.physicalCopyRequired ? 'Yes' : 'No', request.physicalCopyReceivedAt?.toISOString() || '', JSON.stringify(request.customAnswers)])]
  } else if (kind === 'finance') {
    if (!detail.canManage) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
    rows = [['Receipt', 'Date', 'Kind', 'Booking ID', 'Cost ID', 'Currency', 'Amount', 'Included tax', 'Method', 'Reference', 'Description'], ...detail.ledger.map(row => [row.receiptNumber, row.occurredOn, row.kind, row.bookingId, row.costId, detail.event.currency, row.amount / 100, row.tax / 100, row.method, row.reference, row.description])]
  } else if (kind === 'profit' || kind === 'costs') {
    if (!detail.canManage || !detail.finances) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
    rows = kind === 'profit'
      ? [['Event', 'Status', 'Currency', 'Metric', 'Amount'], ...['revenue', 'bookingRevenue', 'otherIncome', 'directCosts', 'overheadCosts', 'grossProfit', 'netProfit', 'collected', 'refunds', 'outstanding', 'refundDue', 'costPaid', 'supplierDue', 'cashSurplus', 'budgetTotal', 'forecastProfit', 'outputTax'].map(key => [detail.event.name, detail.event.status, detail.event.currency, key, (detail.finances as unknown as Record<string, number>)[key]! / 100])]
      : [['Supplier', 'Description', 'Category', 'Status', 'Currency', 'Amount before tax', 'Supplier tax', 'Due date', 'Invoice number'], ...detail.costs.map(cost => [cost.supplier, cost.description, cost.category, cost.status, detail.event.currency, cost.amount / 100, cost.tax / 100, cost.dueDate, cost.invoiceNumber])]
  } else {
    const people = detail.bookings.filter(booking => ['provisional', 'pending', 'confirmed'].includes(booking.status)).flatMap(booking => booking.attendees.map(person => ({ booking, person })))
    const base = (row: typeof people[number]) => [row.booking.reference, row.person.name || 'Name pending', row.person.type]
    const headers = ['Booking', 'Name', 'Type']
    if (kind === 'transport') rows = [[...headers, 'Outward', 'Outward bus / pickup', 'Return', 'Return bus / pickup'], ...people.filter(row => row.person.transportOut || row.person.transportReturn).map(row => [...base(row), row.person.transportOut ? 'Yes' : 'No', row.person.busOut, row.person.transportReturn ? 'Yes' : 'No', row.person.busReturn])]
    else if (kind === 'accommodation') rows = [[...headers, 'Room'], ...people.filter(row => row.person.accommodation).map(row => [...base(row), row.person.room])]
    else if (kind === 'meals') rows = [[...headers, 'Meal preference'], ...people.map(row => [...base(row), row.person.meal])]
    else if (kind === 'emergency') rows = [[...headers, 'Emergency contact', 'Emergency phone', 'Booking contact', 'Booking phone', 'Medical / dietary requirements'], ...people.map(row => [...base(row), row.booking.emergencyName, row.booking.emergencyPhone, row.booking.contactName, row.booking.contactPhone, row.person.medicalNotes])]
    else if (kind === 'attendees') rows = [[...headers, 'Booking status', 'Checked in'], ...people.map(row => [...base(row), row.booking.status, row.person.checkedInAt])]
    else throw createError({ statusCode: 400, statusMessage: 'Unknown export' })
  }
  setHeader(http, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(http, 'Content-Disposition', `attachment; filename="event-${detail.event.id}-${kind}.csv"`)
  return '\uFEFF' + toCsv(rows)
})
