import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import PDFDocument from 'pdfkit'
import { getAccessibleDojoIds } from '../../../../utils/permissions'
import fs from 'fs'
import path from 'path'

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Fetch student and organization
  const student = (await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
    with: { dojo: true },
  })) as any

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, orgId),
  })

  // Permission
  if (student.dojoId) {
    const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, orgId)
    if (accessibleDojoIds !== null && !accessibleDojoIds.includes(student.dojoId)) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }
  } else {
    const user = await db.query.users.findFirst({ where: eq(tables.users.id, session.user.id) })
    if (!user || !['owner', 'admin'].includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }
  }

  const query = getQuery(event)
  const { from, to } = querySchema.parse(query)
  const fromTs = from ? new Date(from).getTime() : undefined
  const toTs = to ? new Date(to).getTime() : undefined

  // Fetch attendance records
  const allRecords = (await db.query.attendance.findMany({
    where: eq(tables.attendance.studentId, Number(studentId)),
    with: {
      session: {
        with: {
          dojo: true,
          instructor: true,
        },
      },
    },
  })) as any[]

  // Filter and sort
  const filtered = allRecords
    .filter((rec) => {
      const recordDate = rec.session?.date
      if (fromTs && recordDate < fromTs) return false
      if (toTs && recordDate > toTs) return false
      return true
    })
    .sort((a, b) => {
      const dateA = a.session?.date || 0
      const dateB = b.session?.date || 0
      if (dateA !== dateB) return dateB - dateA
      const timeA = a.session?.startTime || ''
      const timeB = b.session?.startTime || ''
      return timeB.localeCompare(timeA)
    })

  // Stats
  const totalClasses = filtered.length
  const present = filtered.filter(r => r.status === 'present').length
  const absent = filtered.filter(r => r.status === 'absent').length
  const late = filtered.filter(r => r.status === 'late').length
  const excused = filtered.filter(r => r.status === 'excused').length
  const attendancePercentage = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0

  // --- PDF Generation ---
  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(chunk))
  doc.on('end', () => {})

  const pageWidth = doc.page.width
  const centerX = pageWidth / 2

  let yPos = 30

  // ----- Logo (centered, small) -----
  if (organization?.logo) {
    const logoPath = path.join(process.cwd(), 'public', organization.logo)
    const logoWidth = 50
    const logoHeight = 50
    try {
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, centerX - logoWidth / 2, yPos, { width: logoWidth, height: logoHeight })
        yPos += logoHeight + 6
      }
    } catch (e) { /* ignore */ }
  }

  // ----- Organization Name (centered) -----
  const orgName = organization?.name || 'OpenDojo'
  doc.fontSize(18).font('Helvetica-Bold').text(orgName, 0, yPos, { align: 'center' })
  yPos += 20

  // ----- Title (centered) -----
  doc.fontSize(13).font('Helvetica').text('Attendance Report', 0, yPos, { align: 'center' })
  yPos += 16

  // ----- Period (centered) -----
  const periodLabel = from && to
    ? `Period: ${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}`
    : from
      ? `From: ${new Date(from).toLocaleDateString()}`
      : to
        ? `Until: ${new Date(to).toLocaleDateString()}`
        : 'All time'
  doc.fontSize(10).font('Helvetica').text(periodLabel, 0, yPos, { align: 'center' })
  yPos += 20

  // ----- Student Details -----
  doc.fontSize(11).font('Helvetica-Bold').text('Student Details', 50, yPos)
  yPos += 16
  doc.fontSize(10).font('Helvetica')
  const detailLines = [
    `Name: ${student.firstName ?? ''} ${student.lastName ?? ''}`,
    `Dojo: ${student.dojo?.name ?? 'N/A'}`,
  ]
  for (const line of detailLines) {
    doc.text(line, 50, yPos)
    yPos += 14
  }
  yPos += 8

  // ----- Summary Stats (grid) -----
  const stats = [
    { label: 'Total Classes', value: totalClasses },
    { label: 'Present', value: present },
    { label: 'Absent', value: absent },
    { label: 'Late', value: late },
    { label: 'Excused', value: excused },
    { label: 'Attendance %', value: `${attendancePercentage}%` },
  ]

  const statWidth = (pageWidth - 80) / stats.length
  const statXStart = 40

  doc.fontSize(10).font('Helvetica-Bold')
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]!
    const x = statXStart + i * statWidth
    doc.text(s.label, x, yPos, { width: statWidth, align: 'center' })
  }
  yPos += 14
  doc.fontSize(10).font('Helvetica')
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]!
    const x = statXStart + i * statWidth
    doc.text(String(s.value), x, yPos, { width: statWidth, align: 'center' })
  }
  yPos += 22

  // ----- Attendance Table -----
  doc.fontSize(11).font('Helvetica-Bold').text('Attendance Records', 50, yPos)
  yPos += 16

  if (filtered.length === 0) {
    doc.fontSize(10).font('Helvetica').text('No attendance records found.', 50, yPos)
  } else {
    const headers = ['Date', 'Start', 'End', 'Class', 'Dojo', 'Instructor', 'Status', 'Notes']
    const colWidths = [60, 35, 35, 60, 60, 60, 50, 70] // total 430
    const rows = filtered.map((rec) => {
      const r = rec
      return [
        r.session?.date ? new Date(r.session.date).toLocaleDateString() : '',
        r.session?.startTime ?? '',
        r.session?.endTime ?? '',
        r.session?.name ?? 'Class',
        r.session?.dojo?.name ?? 'N/A',
        r.session?.instructor?.name ?? 'N/A',
        r.status ?? '',
        r.notes ?? '',
      ]
    })

    let x = 50
    let rowY = yPos
    const rowHeight = 14

    // Header
    doc.fontSize(9).font('Helvetica-Bold')
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!
      const width = colWidths[i]!
      doc.text(header, x, rowY, { width, align: 'center' })
      x += width
    }
    doc.font('Helvetica')
    rowY += rowHeight

    // Underline
    doc.moveTo(50, rowY - 3).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), rowY - 3).stroke()
    rowY += 4

    // Data rows
    for (const row of rows) {
      x = 50
      if (rowY + rowHeight > doc.page.height - 30) {
        doc.addPage()
        rowY = 40
        // Optionally re-draw header on new page (we skip for simplicity)
      }
      for (let i = 0; i < row.length; i++) {
        const value = row[i] ?? ''
        const width = colWidths[i]!
        doc.fontSize(9).text(value, x, rowY, { width, align: 'left' })
        x += width
      }
      rowY += rowHeight
    }
  }

  // Footer
  doc.fontSize(8).font('Helvetica')
  doc.text(`Generated on ${new Date().toLocaleString()}`, 0, doc.page.height - 20, { align: 'center' })

  doc.end()

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks)
      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="attendance_${student.firstName ?? 'student'}_${student.lastName ?? 'report'}.pdf"`)
      event.node.res.setHeader('Content-Length', pdfBuffer.length.toString())
      event.node.res.end(pdfBuffer)
      resolve(null)
    })
    doc.on('error', reject)
  })
})