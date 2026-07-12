import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { getAccessibleDojoIds } from '../../../utils/permissions'

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

  // Fetch payment with relations
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

  // Permission check
  if (payment.student?.dojoId) {
    const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, orgId)
    if (accessibleDojoIds !== null && !accessibleDojoIds.includes(payment.student.dojoId)) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }
  } else {
    const user = await db.query.users.findFirst({ where: eq(tables.users.id, session.user.id) })
    if (!user || !['owner', 'admin'].includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }
  }

  // Fetch organization
  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, orgId),
  })

  // --- PDF Generation ---
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))
  doc.on('end', () => {})

  const pageWidth = doc.page.width
  const centerX = pageWidth / 2
  let yPos = 40

  // Logo (centered)
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

  // Organization name (centered)
  const orgName = organization?.name || 'OpenDojo'
  doc.fontSize(20).font('Helvetica-Bold').text(orgName, 0, yPos, { align: 'center' })
  yPos += 24

  // Title (centered)
  doc.fontSize(14).font('Helvetica').text('Payment Receipt', 0, yPos, { align: 'center' })
  yPos += 20

  // Receipt number & date (centered)
  doc.fontSize(10).font('Helvetica')
  const receiptDate = new Date(payment.paymentDate).toLocaleDateString()
  doc.text(`Receipt #: ${payment.receiptNumber}  |  Date: ${receiptDate}`, 0, yPos, { align: 'center' })
  yPos += 28

  // Separator line
  doc.moveTo(50, yPos).lineTo(pageWidth - 50, yPos).stroke()
  yPos += 15

  // Student Details
  doc.fontSize(12).font('Helvetica-Bold').text('Student Details', 50, yPos)
  yPos += 18
  doc.fontSize(10).font('Helvetica')
  const studentName = payment.student ? `${payment.student.firstName} ${payment.student.lastName}` : 'Unknown'
  const dojoName = payment.student?.dojo?.name || 'N/A'
  doc.text(`Name: ${studentName}`, 50, yPos)
  yPos += 14
  doc.text(`Dojo: ${dojoName}`, 50, yPos)
  yPos += 18

  // Payment Details
  doc.fontSize(12).font('Helvetica-Bold').text('Payment Details', 50, yPos)
  yPos += 18
  doc.fontSize(10).font('Helvetica')

  // List details with label and value on same line using colons
  const details = [
    { label: 'Amount', value: `₹${(payment.amount / 100).toFixed(2)}` },
    { label: 'Method', value: payment.method || 'N/A' },
    { label: 'Reference', value: payment.referenceNumber || 'N/A' },
    { label: 'Fee Plan', value: payment.assignment?.feePlan?.name || 'N/A' },
    { label: 'Status', value: 'Paid' },
  ]

  // Use a simple approach: each line is "label: value"
  for (const d of details) {
    doc.text(`${d.label}: ${d.value}`, 50, yPos)
    yPos += 14
  }

  // Footer
  doc.fontSize(8).font('Helvetica')
  doc.text(`Generated on ${new Date().toLocaleString()}`, 0, doc.page.height - 30, { align: 'center' })

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