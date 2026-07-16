import { and, eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { getAccessibleDojoIds } from '../../../../utils/permissions'

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const organizationId = session.user.organizationId
  if (!studentId || !organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid report request' })

  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)),
    with: { dojo: true },
  }) as any
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (student.dojoId) {
    const accessible = await getAccessibleDojoIds(session.user.id, organizationId)
    if (accessible !== null && !accessible.includes(student.dojoId)) throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  } else if (session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Access denied' })

  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId) })
  const { from, to } = querySchema.parse(getQuery(event))
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined
  const toDate = to ? new Date(`${to}T23:59:59.999`) : undefined
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime())) || (fromDate && toDate && fromDate > toDate)) throw createError({ statusCode: 400, statusMessage: 'Invalid report date range' })

  const attendance = await db.query.attendance.findMany({
    where: eq(tables.attendance.studentId, studentId),
    with: { session: { with: { dojo: true, instructor: true } } },
  }) as any[]
  const records = attendance
    .filter(record => (!fromDate || new Date(record.session?.date) >= fromDate) && (!toDate || new Date(record.session?.date) <= toDate))
    .sort((a, b) => Number(b.session?.date || 0) - Number(a.session?.date || 0))

  const total = records.length
  const present = records.filter(record => record.status === 'present').length
  const absent = records.filter(record => record.status === 'absent').length
  const late = records.filter(record => record.status === 'late').length
  const excused = records.filter(record => record.status === 'excused').length
  const attendancePercent = total ? Math.round(((present + late) / total) * 100) : 0

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const pdf = new Promise((resolve, reject) => {
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader('Content-Disposition', `attachment; filename="attendance_${student.firstName}_${student.lastName}.pdf"`)
      event.node.res.setHeader('Content-Length', buffer.length.toString())
      event.node.res.end(buffer)
      resolve(null)
    })
    doc.on('error', reject)
  })

  const pageWidth = doc.page.width
  const contentX = 50
  const contentWidth = pageWidth - 100
  let y = 48
  const colors = { primary: '#4f46e5', slate: '#0f172a', muted: '#64748b', border: '#dbe3ee', present: '#16a34a', absent: '#dc2626', late: '#d97706', excused: '#64748b' }

  if (organization?.logo) {
    const logoPath = path.join(process.cwd(), 'public', organization.logo)
    if (fs.existsSync(logoPath)) {
      try { doc.image(logoPath, pageWidth / 2 - 28, y, { width: 56, height: 56 }) } catch { /* invalid image ignored */ }
      y += 67
    }
  }
  doc.font('Helvetica-Bold').fontSize(20).fillColor(colors.slate).text(organization?.name || 'OpenDojo', contentX, y, { width: contentWidth, align: 'center' })
  y += 28
  doc.font('Helvetica').fontSize(12).fillColor(colors.primary).text('ATTENDANCE REPORT', contentX, y, { width: contentWidth, align: 'center', characterSpacing: 1.1 })
  y += 21
  const period = from || to ? `${from ? new Date(`${from}T00:00:00`).toLocaleDateString('en-IN') : 'Beginning'} – ${to ? new Date(`${to}T00:00:00`).toLocaleDateString('en-IN') : 'Today'}` : 'All attendance records'
  doc.fontSize(10.5).fillColor(colors.muted).text(period, contentX, y, { width: contentWidth, align: 'center' })
  y += 28

  doc.roundedRect(contentX, y, contentWidth, 55, 7).fill('#eef2ff')
  doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.slate).text(`${student.firstName} ${student.lastName}`, contentX + 16, y + 13)
  doc.font('Helvetica').fontSize(10.5).fillColor(colors.muted).text(`Dojo: ${student.dojo?.name || 'Not assigned'}`, contentX + 16, y + 30)
  y += 75

  const stats = [
    { label: 'Classes', value: total, color: '#e0e7ff', text: colors.primary },
    { label: 'Present', value: present, color: '#dcfce7', text: colors.present },
    { label: 'Late', value: late, color: '#fef3c7', text: colors.late },
    { label: 'Absent', value: absent, color: '#fee2e2', text: colors.absent },
    { label: 'Excused', value: excused, color: '#e2e8f0', text: colors.excused },
    { label: 'Attendance', value: `${attendancePercent}%`, color: '#ede9fe', text: '#7c3aed' },
  ]
  const statWidth = (contentWidth - (stats.length - 1) * 5) / stats.length
  for (let index = 0; index < stats.length; index++) {
    const stat = stats[index]!
    const x = contentX + index * (statWidth + 5)
    doc.roundedRect(x, y, statWidth, 50, 6).fill(stat.color)
    doc.font('Helvetica-Bold').fontSize(14).fillColor(stat.text).text(String(stat.value), x, y + 11, { width: statWidth, align: 'center' })
    doc.font('Helvetica').fontSize(8.5).fillColor(colors.muted).text(stat.label.toUpperCase(), x, y + 30, { width: statWidth, align: 'center' })
  }
  y += 74

  const columns = [contentX, contentX + 58, contentX + 105, contentX + 172, contentX + 237, contentX + 307, contentX + 374]
  const widths = [58, 47, 67, 65, 70, 67, 121]
  const drawTableHeader = () => {
    doc.roundedRect(contentX, y, contentWidth, 24, 5).fill(colors.slate)
    const labels = ['Date', 'Start', 'Class', 'Dojo', 'Instructor', 'Status', 'Notes']
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
    labels.forEach((label, index) => doc.text(label, columns[index]!, y + 8, { width: widths[index]!, align: index === 5 ? 'center' : 'left' }))
    y += 30
  }
  doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.slate).text('Attendance history', contentX, y)
  y += 19
  drawTableHeader()
  if (!records.length) {
    doc.font('Helvetica').fontSize(10).fillColor(colors.muted).text('No attendance records found for this period.', contentX, y + 6, { width: contentWidth, align: 'center' })
  } else {
    for (let index = 0; index < records.length; index++) {
      const record = records[index]!
      if (y > doc.page.height - 90) { doc.addPage(); y = 55; drawTableHeader() }
      if (index % 2 === 0) doc.rect(contentX, y - 4, contentWidth, 20).fill('#f8fafc')
      const status = record.status || 'present'
      const statusColor = status === 'present' ? colors.present : status === 'late' ? colors.late : status === 'absent' ? colors.absent : colors.excused
      doc.font('Helvetica').fontSize(8.5).fillColor(colors.slate)
      doc.text(new Date(record.session?.date).toLocaleDateString('en-IN'), columns[0]!, y, { width: widths[0]! })
      doc.text(record.session?.startTime || '—', columns[1]!, y, { width: widths[1]! })
      doc.text(record.session?.name || 'Class', columns[2]!, y, { width: widths[2]! })
      doc.text(record.session?.dojo?.name || '—', columns[3]!, y, { width: widths[3]! })
      doc.text(record.session?.instructor?.name || '—', columns[4]!, y, { width: widths[4]! })
      doc.font('Helvetica-Bold').fillColor(statusColor).text(String(status).toUpperCase(), columns[5]!, y, { width: widths[5]!, align: 'center' })
      doc.font('Helvetica').fillColor(colors.slate).text(record.notes || '—', columns[6]!, y, { width: widths[6]! })
      y += 20
    }
  }
  if (y > doc.page.height - 145) { doc.addPage(); y = 55 }
  doc.roundedRect(contentX, y + 14, contentWidth, 54, 7).fill('#eff6ff')
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.primary).text('GRADING ELIGIBILITY', contentX + 14, y + 26)
  doc.font('Helvetica').fontSize(9).fillColor(colors.slate).text(
    'Students are expected to maintain at least 80% attendance to be considered for their next grading. Final eligibility remains subject to instructor assessment and dojo policy.',
    contentX + 14,
    y + 41,
    { width: contentWidth - 28, lineBreak: false }
  )
  doc.font('Helvetica').fontSize(9).fillColor(colors.muted).text(`Generated ${new Date().toLocaleString('en-IN')}`, contentX, doc.page.height - 70, { width: contentWidth, align: 'center', lineBreak: false })
  doc.end()
  return pdf
})
