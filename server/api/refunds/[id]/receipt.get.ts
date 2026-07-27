import { eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import { db, tables } from '../../../utils/database'
import { formatAmount } from '../../../utils/currency'
import { getAccessibleDojoIds } from '../../../utils/permissions'

function receiptAmount(amount: number, currency: string) {
  return currency === 'INR' ? `INR ${(amount / 100).toFixed(2)}` : formatAmount(amount, currency)
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const refundId = Number(getRouterParam(event, 'id'))
  if (!refundId) throw createError({ statusCode: 400, statusMessage: 'Invalid refund receipt request' })

  const refund = await db.query.paymentRefunds.findFirst({
    where: eq(tables.paymentRefunds.id, refundId),
    with: { payment: { with: { student: { with: { dojo: true } } } }, creator: true },
  }) as any
  const payment = refund?.payment
  if (!refund || !payment || payment.student.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Refund not found' })
  }

  const portalStudentId = Number((session.user as unknown as Record<string, unknown>).studentId)
  if (session.user.role === 'student') {
    if (!portalStudentId || payment.studentId !== portalStudentId) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  } else if (payment.student.dojoId) {
    const accessible = await getAccessibleDojoIds(session.user.id, session.user.organizationId)
    if (accessible !== null && !accessible.includes(payment.student.dojoId) && session.user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }
  } else if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, session.user.organizationId),
  })
  const currency = organization?.currency || 'INR'
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const pdf = new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="refund_${refund.refundNumber}.pdf"`)
      event.node.res.setHeader('Content-Length', String(buffer.length))
      event.node.res.end(buffer)
      resolve(null)
    })
    doc.on('error', reject)
  })

  const width = doc.page.width - 100
  const primary = '#991b1b'
  const ink = '#172033'
  const muted = '#64748b'
  doc.rect(0, 0, doc.page.width, 150).fill(primary)
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#ffffff').text(organization?.name || 'OpenDojos', 50, 45)
  doc.font('Helvetica').fontSize(10).fillColor('#fecaca').text('REFUND RECEIPT', 50, 76, { characterSpacing: 1.3 })
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(refund.refundNumber, 350, 49, { width: 195, align: 'right' })
  doc.font('Helvetica').fontSize(9.5).fillColor('#fecaca').text(new Date(refund.refundedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }), 350, 70, { width: 195, align: 'right' })

  let y = 180
  doc.roundedRect(50, y, width, 88, 14).fill('#fef2f2')
  doc.font('Helvetica-Bold').fontSize(11).fillColor(primary).text('AMOUNT REFUNDED', 72, y + 18)
  doc.fontSize(28).fillColor(ink).text(receiptAmount(refund.amount, currency), 72, y + 39)
  y += 116

  const rows: Array<[string, string]> = [
    ['Student', `${payment.student.firstName} ${payment.student.lastName}`],
    ['Dojo', payment.student.dojo?.name || 'Not assigned'],
    ['Original receipt', payment.receiptNumber],
    ['Original payment', receiptAmount(payment.amount, currency)],
    ['Tuition returned', receiptAmount(refund.tuitionAmount, currency)],
    ['Refund method', String(refund.method).replaceAll('_', ' ')],
    ...(refund.referenceNumber ? [['Reference', refund.referenceNumber] as [string, string]] : []),
    ['Reason', refund.reason],
    ['Recorded by', refund.creator?.name || 'Organization administrator'],
  ]
  doc.font('Helvetica-Bold').fontSize(14).fillColor(ink).text('Refund details', 50, y)
  y += 28
  for (const [label, value] of rows) {
    const valueHeight = Math.max(18, doc.heightOfString(value, { width: 315 }))
    const rowHeight = Math.max(34, valueHeight + 14)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(muted).text(label.toUpperCase(), 65, y + 9, { width: 130 })
    doc.font('Helvetica').fontSize(11.5).fillColor(ink).text(value, 205, y + 7, { width: 315, align: 'right' })
    doc.strokeColor('#e2e8f0').lineWidth(0.7).moveTo(65, y + rowHeight).lineTo(530, y + rowHeight).stroke()
    y += rowHeight
  }

  doc.font('Helvetica').fontSize(9).fillColor(muted).text(
    'This document records a refund against the original payment shown above. Retain both documents for your records.',
    50,
    doc.page.height - 76,
    { width, align: 'center', lineBreak: false },
  )
  doc.end()
  return pdf
})
