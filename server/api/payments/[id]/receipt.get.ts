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

// PDFKit's built-in Helvetica font cannot encode the Indian Rupee glyph. Using
// the ISO currency code avoids it being rendered as a stray superscript "1".
function formatReceiptAmount(amount: number, currency: string) {
  return currency === 'INR' ? `INR ${(amount / 100).toFixed(2)}` : formatAmount(amount, currency)
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
  const pageHeight = doc.page.height
  const contentX = 50
  const contentWidth = pageWidth - (contentX * 2)
  const primary = '#5b21b6'
  const accent = '#8b5cf6'
  const ink = '#172033'
  const muted = '#64748b'
  const paymentDate = new Date(payment.paymentDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })

  // Branded header gives each receipt a polished, easy-to-scan identity.
  doc.rect(0, 0, pageWidth, 158).fill(primary)
  doc.circle(pageWidth - 12, 8, 102).fillOpacity(0.14).fill('#c4b5fd').fillOpacity(1)
  doc.circle(pageWidth - 85, 125, 58).fillOpacity(0.12).fill('#ddd6fe').fillOpacity(1)
  doc.roundedRect(contentX, 38, 58, 58, 15).fill('#ffffff')

  if (organization?.logo) {
    const logoPath = path.join(process.cwd(), 'public', organization.logo)
    if (fs.existsSync(logoPath)) {
      try { doc.image(logoPath, contentX + 8, 46, { fit: [42, 42], align: 'center', valign: 'center' }) } catch { /* invalid image ignored */ }
    }
  }

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text(organization?.name || 'OpenDojo', contentX + 76, 45, { width: 255 })
  doc.font('Helvetica').fontSize(10).fillColor('#ddd6fe').text('PAYMENT RECEIPT', contentX + 77, 72, { characterSpacing: 1.2 })
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('PAID', contentX + contentWidth - 78, 46, { width: 78, align: 'right' })
  doc.font('Helvetica').fontSize(9.5).fillColor('#ddd6fe').text(`Receipt ${payment.receiptNumber}`, contentX + contentWidth - 180, 67, { width: 180, align: 'right' })
  doc.fontSize(9.5).text(paymentDate, contentX + contentWidth - 180, 82, { width: 180, align: 'right' })

  let y = 172
  doc.roundedRect(contentX, y, contentWidth, 100, 16).fill('#f5f3ff')
  doc.roundedRect(contentX, y, 7, 100, 4).fill(accent)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(primary).text('AMOUNT RECEIVED', contentX + 27, y + 20, { characterSpacing: 0.6 })
  doc.font('Helvetica-Bold').fontSize(30).fillColor(ink).text(formatReceiptAmount(payment.amount, organization?.currency || 'INR'), contentX + 27, y + 39)
  doc.roundedRect(contentX + contentWidth - 121, y + 31, 94, 34, 17).fill('#dcfce7')
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#15803d').text('PAYMENT PAID', contentX + contentWidth - 114, y + 42, { width: 80, align: 'center' })
  y += 118

  const sectionTitle = (title: string, color: string) => {
    doc.roundedRect(contentX, y + 2, 6, 18, 3).fill(color)
    doc.font('Helvetica-Bold').fontSize(14).fillColor(ink).text(title, contentX + 16, y + 1)
    y += 30
  }
  const detailCard = (items: Array<[string, string]>, tint: string) => {
    const rowHeight = 31
    const height = 20 + items.length * rowHeight
    doc.roundedRect(contentX, y, contentWidth, height, 12).fill(tint)
    items.forEach(([label, value], index) => {
      const rowY = y + 14 + index * rowHeight
      doc.font('Helvetica-Bold').fontSize(11).fillColor(muted).text(label.toUpperCase(), contentX + 18, rowY + 1, { width: 135, characterSpacing: 0.15 })
      doc.font('Helvetica').fontSize(14).fillColor(ink).text(value, contentX + 165, rowY - 3, { width: contentWidth - 184, align: 'right' })
      if (index < items.length - 1) doc.strokeColor('#e2e8f0').lineWidth(0.7).moveTo(contentX + 18, rowY + 24).lineTo(contentX + contentWidth - 18, rowY + 24).stroke()
    })
    y += height + 19
  }

  sectionTitle('Student details', accent)
  detailCard([
    ['Student', `${payment.student.firstName} ${payment.student.lastName}`],
    ['Dojo', payment.student.dojo?.name || 'Not assigned'],
  ], '#f8fafc')

  sectionTitle('Payment details', '#14b8a6')
  detailCard([
    ['Fee plan', payment.assignment?.feePlan?.name || 'General payment'],
    ['Fee period', formatBillingPeriod(payment.billingPeriod, payment.paymentDate)],
    ['Payment method', String(payment.method || 'cash').replaceAll('_', ' ')],
    ...(payment.referenceNumber ? [['Reference', payment.referenceNumber] as [string, string]] : []),
  ], '#f0fdfa')

  // Keep the footer above PDFKit's bottom margin. Writing at pageHeight - 39
  // forces PDFKit to create a new page, which was causing blank receipt pages.
  const footerY = pageHeight - 92
  doc.strokeColor('#ddd6fe').lineWidth(1).moveTo(contentX, footerY).lineTo(contentX + contentWidth, footerY).stroke()
  doc.font('Helvetica-Bold').fontSize(10).fillColor(primary).text('Thank you for your payment.', contentX, footerY + 15, { width: contentWidth, align: 'center' })
  doc.font('Helvetica').fontSize(9).fillColor(muted).text(`Generated ${new Date().toLocaleString('en-IN')}`, contentX, footerY + 30, { width: contentWidth, align: 'center', lineBreak: false })
  doc.end()
  return pdf
})
