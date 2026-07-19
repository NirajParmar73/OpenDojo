import { db, tables } from '../../../../../utils/database'
import { formatFeePeriod } from '../../../../../utils/fee-period'
import { eq, and } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const paymentId = getRouterParam(event, 'id')
  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing payment ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Fetch payment with student, assignment, fee plan, organization
  const payment = await db.query.payments.findFirst({
    where: eq(tables.payments.id, Number(paymentId)),
    with: {
      student: {
        with: { dojo: true },
      },
      assignment: {
        with: { feePlan: true },
      },
    },
  }) as any

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: 'Payment not found' })
  }

  // Verify student belongs to organization
  if (payment.student.organizationId !== orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  // Fetch organization details for logo and name
  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, orgId),
  })

  // Format amount with currency
  const currency = organization?.currency || 'INR'
  // Helvetica cannot encode the Rupee glyph reliably in a PDF, so use a
  // currency code for INR instead of producing a stray superscript character.
  const amountLabel = currency === 'INR' ? `INR ${(payment.amount / 100).toFixed(2)}` : `${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency}${(payment.amount / 100).toFixed(2)}`

  // --- PDF Generation ---
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))
  doc.on('end', () => {})

  const pageWidth = doc.page.width
  const centerX = pageWidth / 2

  let yPos = 40

  // Logo
  if (organization?.logo) {
    const logoPath = path.join(process.cwd(), 'public', organization.logo)
    const logoWidth = 60
    const logoHeight = 60
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, centerX - logoWidth / 2, yPos, { width: logoWidth, height: logoHeight })
        yPos += logoHeight + 8
      }
    } catch (e) { /* ignore */ }
  }

  // Organization name
  const orgName = organization?.name || 'OpenDojo'
  doc.fontSize(20).font('Helvetica-Bold').text(orgName, 0, yPos, { align: 'center' })
  yPos += 24

  // Title
  doc.fontSize(14).font('Helvetica').text('Payment Receipt', 0, yPos, { align: 'center' })
  yPos += 20

  // Receipt number and date
  doc.fontSize(10).font('Helvetica')
  doc.text(`Receipt #: ${payment.receiptNumber}`, 50, yPos)
  const formattedDate = new Date(payment.paymentDate).toLocaleDateString()
  doc.text(`Date: ${formattedDate}`, 400, yPos)
  yPos += 20

  // Student details
  doc.fontSize(12).font('Helvetica-Bold').text('Student Details', 50, yPos)
  yPos += 18
  doc.fontSize(11).font('Helvetica')
  const studentName = `${payment.student.firstName || ''} ${payment.student.lastName || ''}`.trim()
  doc.text(`Name: ${studentName}`, 50, yPos)
  yPos += 16
  doc.text(`Dojo: ${payment.student.dojo?.name || 'N/A'}`, 50, yPos)
  yPos += 20

  // Payment details
  doc.fontSize(12).font('Helvetica-Bold').text('Payment Details', 50, yPos)
  yPos += 18
  doc.fontSize(11).font('Helvetica')
  doc.text(`Amount: ${amountLabel}`, 50, yPos)
  yPos += 16
  doc.text(`Method: ${payment.method}`, 50, yPos)
  yPos += 16
  doc.text(`Fee Period: ${formatFeePeriod(payment.billingPeriod, payment.paymentDate, payment.assignment?.feePlan?.frequency)}`, 50, yPos)
  yPos += 16
  if (payment.referenceNumber) {
    doc.text(`Reference: ${payment.referenceNumber}`, 50, yPos)
    yPos += 16
  }
  if (payment.assignment?.feePlan) {
    doc.text(`Fee Plan: ${payment.assignment.feePlan.name}`, 50, yPos)
    yPos += 16
  }
  if (payment.notes) {
    doc.text(`Notes: ${payment.notes}`, 50, yPos)
    yPos += 16
  }

  // Footer
  // Stay inside the bottom margin so this legacy receipt route cannot append a
  // blank page while drawing its footer.
  yPos = doc.page.height - 82
  doc.fontSize(10).font('Helvetica')
  doc.text(`Generated on ${new Date().toLocaleString()}`, 0, yPos, { align: 'center' })

  doc.end()

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="receipt_${payment.receiptNumber}.pdf"`)
      event.node.res.setHeader('Content-Length', pdfBuffer.length.toString())
      event.node.res.end(pdfBuffer)
      resolve(null)
    })
    doc.on('error', reject)
  })
})
