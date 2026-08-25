import { and, eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import { db, tables } from '../../../utils/database'
import { formatAmount } from '../../../utils/currency'
import { calculateFeeBalance } from '../../../utils/fees'
import { hasStudentReportAccess } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const organizationId = session.user.organizationId
  if (!studentId || !organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid report request' })

  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)),
    with: { dojo: true, program: true },
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (!await hasStudentReportAccess(session.user.id, organizationId, student.dojoId)) throw createError({ statusCode: 403, statusMessage: 'You do not have permission to view student reports' })

  const query = getQuery(event)
  const from = typeof query.from === 'string' && query.from ? new Date(`${query.from}T00:00:00`) : undefined
  const to = typeof query.to === 'string' && query.to ? new Date(`${query.to}T23:59:59.999`) : undefined
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw createError({ statusCode: 400, statusMessage: 'Invalid report date range' })

  const [organization, payments, assignments] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId) }),
    db.query.payments.findMany({ where: eq(tables.payments.studentId, studentId), with: { assignment: { with: { feePlan: true } }, refunds: true }, orderBy: (payment, { desc }) => [desc(payment.paymentDate)] }),
    db.query.studentFeeAssignments.findMany({ where: eq(tables.studentFeeAssignments.studentId, studentId), with: { feePlan: true, payments: { with: { refunds: true } } } }),
  ])
  type LedgerEntry = {
    type: 'payment' | 'refund'
    date: Date
    reference: string
    description: string
    method: string
    amount: number
    payment: any
  }
  const ledger = (payments as any[]).flatMap((payment) => {
    const entries: LedgerEntry[] = [{
      type: 'payment',
      date: new Date(payment.paymentDate),
      reference: payment.receiptNumber,
      description: payment.assignment?.feePlan?.name || 'General payment',
      method: payment.method || 'cash',
      amount: payment.amount,
      payment,
    }]
    for (const refund of payment.refunds.filter((item: any) => item.status === 'completed')) {
      entries.push({
        type: 'refund',
        date: new Date(refund.refundedAt),
        reference: refund.refundNumber,
        description: `Refund for ${payment.receiptNumber}`,
        method: refund.method,
        amount: -refund.amount,
        payment,
      })
    }
    return entries
  }).filter(entry => (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  const totalReceived = ledger.reduce((sum, entry) => sum + entry.amount, 0)
  const totalOutstanding = assignments.reduce((sum, assignment: any) => sum + calculateFeeBalance({ amount: assignment.feePlan.amount, discount: assignment.discount, frequency: assignment.feePlan.frequency, startDate: assignment.startDate, endDate: assignment.endDate, dueDay: assignment.dueDay, payments: assignment.payments }).outstandingAmount, 0)
  const currency = organization?.currency || 'INR'

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const pdf = new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="fee_statement_${student.firstName}_${student.lastName}.pdf"`)
      event.node.res.setHeader('Content-Length', buffer.length.toString())
      event.node.res.end(buffer)
      resolve(null)
    })
    doc.on('error', reject)
  })

  const width = doc.page.width - 100
  let y = 55
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text(organization?.name || 'OpenDojos', 50, y, { width, align: 'center' })
  y += 28
  doc.font('Helvetica').fontSize(12).fillColor('#4b5563').text('FEE STATEMENT', 50, y, { width, align: 'center', characterSpacing: 1 })
  y += 25
  const period = from || to ? `${from ? from.toLocaleDateString('en-IN') : 'Beginning'} – ${to ? to.toLocaleDateString('en-IN') : 'Today'}` : 'All payments'
  doc.fontSize(10.5).fillColor('#6b7280').text(`Statement period: ${period}`, 50, y, { width, align: 'center' })
  y += 28
  doc.strokeColor('#d1d5db').moveTo(50, y).lineTo(50 + width, y).stroke()
  y += 20
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#111827').text('Student details', 50, y)
  y += 18
  doc.font('Helvetica').fontSize(11.5).text(`Student: ${student.firstName} ${student.lastName}`, 50, y); y += 17
  doc.text(`Dojo: ${student.dojo?.name || 'Not assigned'}`, 50, y); y += 17
  doc.text(`Program: ${student.program?.displayName || 'Not assigned'}`, 50, y); y += 25
  doc.roundedRect(50, y, width, 54, 6).fill('#f3f4f6')
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text('Received in selected period', 68, y + 12)
  doc.text('Current outstanding balance', 330, y + 12)
  doc.fontSize(14).fillColor('#111827').text(formatAmount(totalReceived, currency), 68, y + 27)
  doc.text(formatAmount(totalOutstanding, currency), 330, y + 27)
  y += 82
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#111827').text('Payment history', 50, y)
  y += 20
  const columns = [50, 125, 230, 360, 455]
  const headers = ['Date', 'Reference', 'Description', 'Method', 'Amount']
  doc.fontSize(9.5).fillColor('#6b7280')
  headers.forEach((header, index) => doc.text(header, columns[index]!, y, { width: index === 4 ? 85 : 100, align: index === 4 ? 'right' : 'left' }))
  y += 13
  doc.strokeColor('#d1d5db').moveTo(50, y).lineTo(50 + width, y).stroke(); y += 8
  if (!ledger.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('No payments or refunds recorded in this period.', 50, y)
  } else {
    for (const entry of ledger) {
      if (y > doc.page.height - 85) { doc.addPage(); y = 55 }
      doc.font('Helvetica').fontSize(10).fillColor('#111827')
      doc.text(entry.date.toLocaleDateString('en-IN'), columns[0]!, y, { width: 70 })
      doc.text(entry.reference, columns[1]!, y, { width: 100 })
      doc.text(entry.description, columns[2]!, y, { width: 120 })
      doc.text(String(entry.method).replaceAll('_', ' '), columns[3]!, y, { width: 80 })
      doc.fillColor(entry.type === 'refund' ? '#b91c1c' : '#111827').text(formatAmount(entry.amount, currency), columns[4]!, y, { width: 85, align: 'right' })
      y += 21
    }
  }
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(`Generated ${new Date().toLocaleString('en-IN')}`, 50, doc.page.height - 70, { width, align: 'center', lineBreak: false })
  doc.end()
  return pdf
})
