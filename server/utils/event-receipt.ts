import PDFDocument from 'pdfkit'
import type { H3Event } from 'h3'
import { eventActor, getEventDetail } from './events'
import { formatAmount } from './currency'

export async function eventReceipt(http: H3Event, portal = false) {
  const detail = await getEventDetail(await eventActor(http, portal), Number(getRouterParam(http, 'id')))
  const query = getQuery(http)
  const transaction = query.transactionId ? detail.ledger.find(row => row.id === Number(query.transactionId)) : null
  const booking = detail.bookings.find(row => row.id === (transaction?.bookingId || Number(query.bookingId)))
  if ((query.transactionId && !transaction) || (!transaction && !booking)) throw createError({ statusCode: 404, statusMessage: 'Receipt not found' })
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  const result = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const amount = (value: number) => formatAmount(value, detail.event.currency)
  doc.fillColor('#5b21b6').fontSize(22).text(detail.event.name)
  doc.moveDown(0.5).fillColor('#475569').fontSize(11).text(`${detail.event.startDate} - ${detail.event.endDate} | ${detail.event.venue}`)
  doc.moveDown().fillColor('#0f172a').fontSize(16).text(transaction ? `${transaction.kind.replaceAll('_', ' ').toUpperCase()} RECEIPT` : 'BOOKING SUMMARY')
  doc.fontSize(10).text(transaction?.receiptNumber || booking!.reference).moveDown()
  if (transaction) {
    doc.fontSize(20).text(amount(transaction.amount)).fontSize(11).moveDown()
    doc.text(`Date: ${transaction.occurredOn}`).text(`Method: ${transaction.method}`).text(`Reference: ${transaction.reference || '-'}`).text(`Description: ${transaction.description}`)
    if (transaction.tax) doc.text(`Included tax: ${amount(transaction.tax)}`)
    if (transaction.sourceId) doc.text(`Original transaction: ${detail.ledger.find(row => row.id === transaction.sourceId)?.receiptNumber || transaction.sourceId}`)
  }
  if (booking) {
    doc.moveDown().font('Helvetica-Bold').text(`Booking ${booking.reference} - ${booking.status}`).font('Helvetica')
    doc.text(`Contact: ${booking.contactName || 'Pending'} | ${booking.contactPhone || 'Pending'}`).moveDown()
    for (const person of booking.attendees) doc.text(`${person.name || 'Parent name pending'} (${person.type}) | ${person.meal || 'Meal pending'} | Stay: ${person.accommodation ? 'Yes' : 'No'} | Bus: ${person.transportOut ? 'Out' : '-'} / ${person.transportReturn ? 'Return' : '-'}`)
    doc.moveDown().text(`Booking charges before tax: ${amount(booking.balance.net)}`).text(`Tax: ${amount(booking.balance.tax)}`).text(`Total: ${amount(booking.balance.total)}`).text(`Net paid: ${amount(booking.balance.paid)}`).text(`Outstanding: ${amount(booking.balance.outstanding)}`).text(`Refund / credit due: ${amount(booking.balance.credit)}`)
    doc.moveDown().fontSize(10).text('Balances above are current at the time of download. A booking summary does not acknowledge payment; transaction receipts record individual settlements.')
    if (!transaction) { doc.moveDown().text(`Consent: ${booking.consent.accepted ? `${booking.consent.name}, ${booking.consent.acceptedAt}` : 'Pending'}`); doc.moveDown().text(booking.consent.terms || '') }
  }
  doc.end()
  const buffer = await result
  setHeader(http, 'Content-Type', 'application/pdf')
  setHeader(http, 'Content-Disposition', `attachment; filename="${transaction?.receiptNumber || booking!.reference}.pdf"`)
  return buffer
}
