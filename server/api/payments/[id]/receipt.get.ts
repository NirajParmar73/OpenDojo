import { eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { db, tables } from '../../../utils/database'
import { formatAmount } from '../../../utils/currency'
import { getAccessibleDojoIds } from '../../../utils/permissions'

function formatBillingPeriod(billingPeriod: string | null, paymentDate: Date | number) {
  const date = billingPeriod ? new Date(`${billingPeriod}-01T00:00:00`) : new Date(paymentDate)
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const paymentId = Number(getRouterParam(event, 'id'))
  const organizationId = session.user.organizationId
  if (!paymentId || !organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid receipt request' })

  const payment = await db.query.payments.findFirst({
    where: eq(tables.payments.id, paymentId),
    with: { student: { with: { dojo: true } }, assignment: { with: { feePlan: true } } },
  }) as any
  if (!payment || payment.student.organizationId !== organizationId) throw createError({ statusCode: 404, statusMessage: 'Payment not found' })

  if (payment.student.dojoId) {
    const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, organizationId)
    if (accessibleDojoIds !== null && !accessibleDojoIds.includes(payment.student.dojoId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  } else if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId) })
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))

  const pdf = new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="receipt_${payment.receiptNumber}.pdf"`)
      event.node.res.setHeader('Content-Length', buffer.length.toString())
      event.node.res.end(buffer)
      resolve(null)
    })
    doc.on('error', reject)
  })

  const pageWidth = doc.page.width
  const contentWidth = 420
  const contentX = (pageWidth - contentWidth) / 2
  const valueX = contentX + 150
  let y = 52

  if (organization?.logo) {
    const logoPath = path.join(process.cwd(), 'public', organization.logo)
    if (fs.existsSync(logoPath)) {
      try { doc.image(logoPath, pageWidth / 2 - 30, y, { width: 60, height: 60 }) } catch { /* invalid image ignored */ }
      y += 70
    }
  }

  doc.font('Helvetica-Bold').fontSize(21).fillColor('#111827').text(organization?.name || 'OpenDojo', contentX, y, { width: contentWidth, align: 'center' })
  y += 29
  doc.font('Helvetica').fontSize(12).fillColor('#4b5563').text('PAYMENT RECEIPT', contentX, y, { width: contentWidth, align: 'center', characterSpacing: 1.2 })
  y += 25
  doc.fontSize(9).fillColor('#6b7280').text(`Receipt ${payment.receiptNumber}  •  ${new Date(payment.paymentDate).toLocaleDateString('en-IN')}`, contentX, y, { width: contentWidth, align: 'center' })
  y += 28
  doc.strokeColor('#d1d5db').lineWidth(1).moveTo(contentX, y).lineTo(contentX + contentWidth, y).stroke()
  y += 23

  const section = (title: string) => {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(title.toUpperCase(), contentX, y)
    y += 19
  }
  const row = (label: string, value: string, highlight = false) => {
    if (highlight) doc.roundedRect(contentX, y - 5, contentWidth, 29, 6).fill('#f3f4f6')
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#4b5563').text(label, contentX, y + 2, { width: 135, align: 'right' })
    doc.font(highlight ? 'Helvetica-Bold' : 'Helvetica').fontSize(highlight ? 12 : 10).fillColor('#111827').text(value, valueX, y, { width: contentWidth - 150 })
    y += highlight ? 36 : 22
  }

  section('Student details')
  row('Student', `${payment.student.firstName} ${payment.student.lastName}`)
  row('Dojo', payment.student.dojo?.name || 'Not assigned')
  y += 9
  section('Payment details')
  row('Amount paid', formatAmount(payment.amount, organization?.currency || 'INR'), true)
  row('Fee plan', payment.assignment?.feePlan?.name || 'General payment')
  row('Fee period', formatBillingPeriod(payment.billingPeriod, payment.paymentDate))
  row('Payment method', String(payment.method || 'cash').replaceAll('_', ' '))
  if (payment.referenceNumber) row('Reference', payment.referenceNumber)
  row('Payment status', 'Paid')

  doc.strokeColor('#d1d5db').lineWidth(1).moveTo(contentX, y + 2).lineTo(contentX + contentWidth, y + 2).stroke()
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(`Generated ${new Date().toLocaleString('en-IN')}`, contentX, doc.page.height - 70, { width: contentWidth, align: 'center', lineBreak: false })
  doc.end()
  return pdf
})
