import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'

const PAGE_WIDTH = 595.28
const MARGIN = 34
const PURPLE = '#5b21b6'
const INK = '#172033'
const MUTED = '#64748b'
const RULE = '#e2e8f0'
const SECTION_FILL = '#f5f3ff'

const upper = (value: unknown) => String(value ?? '').toLocaleUpperCase('en-IN')
const printable = (value: unknown) => {
  const text = String(value ?? '').trim()
  return upper(text || '-')
}

function formatDate(value: unknown) {
  return new Date(value as string | number | Date).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

type PdfRow = [label: string, value?: unknown]

export async function createAdmissionPdf(application: any, organization: any) {
  // Pages are added explicitly so a text-flow overflow can never create a trailing page.
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: upper(`Admission application ${application.referenceNumber}`),
      Author: upper(organization.name)
    }
  })
  doc.addPage({ size: 'A4', margin: 0 })

  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const contentWidth = PAGE_WIDTH - (MARGIN * 2)
  const gap = 16
  const columnWidth = (contentWidth - gap) / 2
  const leftX = MARGIN
  const rightX = MARGIN + columnWidth + gap
  const headerY = 30

  doc.roundedRect(MARGIN, headerY, contentWidth, 82, 13).fill(PURPLE)
  const logoPath = organization.logo ? path.join(process.cwd(), 'public', organization.logo) : null
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.roundedRect(MARGIN + 13, headerY + 12, 58, 58, 10).fill('#ffffff')
      doc.image(logoPath, MARGIN + 19, headerY + 18, { fit: [46, 46], align: 'center', valign: 'center' })
    } catch { /* malformed images are omitted */ }
  }

  const fittedSize = (text: string, font: string, width: number, preferred: number, minimum: number) => {
    doc.font(font)
    let size = preferred
    while (size > minimum && doc.fontSize(size).widthOfString(text) > width) size -= 0.25
    return size
  }
  const titleX = MARGIN + 84
  const organizationName = upper(organization.name)
  doc.font('Helvetica-Bold').fontSize(fittedSize(organizationName, 'Helvetica-Bold', 290, 17, 9)).fillColor('#ffffff')
    .text(organizationName, titleX, headerY + 17, { width: 290, lineBreak: false })
  doc.font('Helvetica').fontSize(9).fillColor('#ddd6fe')
    .text('ADMISSION APPLICATION - PENDING APPROVAL', titleX, headerY + 47, { width: 300, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
    .text(printable(application.referenceNumber), MARGIN + contentWidth - 145, headerY + 18, { width: 132, align: 'right', lineBreak: false })
  doc.font('Helvetica').fontSize(8).fillColor('#ddd6fe')
    .text(upper(formatDate(application.submittedAt)), MARGIN + contentWidth - 145, headerY + 40, { width: 132, align: 'right', lineBreak: false })

  const summaryY = 124
  const photoPath = application.photoPath ? path.join(process.cwd(), 'public', application.photoPath) : null
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      doc.roundedRect(MARGIN, summaryY, 62, 76, 9).strokeColor('#cbd5e1').lineWidth(0.8).stroke()
      doc.image(photoPath, MARGIN + 4, summaryY + 4, { fit: [54, 68], align: 'center', valign: 'center' })
    } catch { /* malformed images are omitted */ }
  }
  const summaryX = MARGIN + 76
  const summaryWidth = contentWidth - 76
  const applicantName = printable(`${application.firstName} ${application.lastName}`)
  doc.font('Helvetica-Bold').fontSize(fittedSize(applicantName, 'Helvetica-Bold', summaryWidth, 15, 8)).fillColor(INK)
    .text(applicantName, summaryX, summaryY + 4, { width: summaryWidth, lineBreak: false })
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text(upper(`Preferred dojo: ${application.dojo?.name || '-'}`), summaryX, summaryY + 30, { width: contentWidth - 76, lineBreak: false })
    .text(upper(`Program: ${application.program?.displayName || 'Not selected'}`), summaryX, summaryY + 46, { width: contentWidth - 76, lineBreak: false })
    .text(upper(`Application status: ${String(application.status).replaceAll('_', ' ')}`), summaryX, summaryY + 62, { width: contentWidth - 76, lineBreak: false })

  const address = [application.address, application.city, application.stateProvince, application.postalCode, application.country].filter(Boolean).join(', ')
  const studentRows: PdfRow[] = [
    ['Date of birth', formatDate(application.dateOfBirth)],
    ['Gender', application.gender],
    ['Email', application.email],
    ['Phone', application.phone],
    ['Address', address],
    ['Preferred start date', application.preferredStartDate ? formatDate(application.preferredStartDate) : null],
    ['Previous experience', application.previousExperience]
  ]
  const guardianRows: PdfRow[] = [
    ['Name', application.guardianName],
    ['Relationship', application.guardianRelationship],
    ['Phone', application.guardianPhone],
    ['Email', application.guardianEmail]
  ]
  const emergencyRows: PdfRow[] = [
    ['Emergency contact', application.emergencyContact],
    ['Emergency phone', application.emergencyPhone],
    ['Medical notes', application.medicalNotes || 'None declared']
  ]
  const organizationRows: PdfRow[] = [
    ['Physical copy received', 'Yes / No   Date: __________________'],
    ['Decision', 'Approved / Rejected   Date: __________________'],
    ['Authorized signature', '____________________________________']
  ]
  const snapshot = application.formSnapshot || {}
  const consentText = printable(snapshot.consentText)
  const acceptedOnline = upper(new Date(application.consentAcceptedAt).toLocaleString('en-IN'))
  const bodyTop = 216
  const bodyBottom = 793
  const availableHeight = bodyBottom - bodyTop

  const sectionHeight = (fontSize: number) => fontSize + 14
  const rowHeight = (label: string, value: unknown, fontSize: number) => {
    const labelWidth = 86
    const valueWidth = columnWidth - labelWidth - 14
    doc.font('Helvetica-Bold').fontSize(fontSize - 0.5)
    const labelHeight = doc.heightOfString(upper(label), { width: labelWidth, lineGap: 0.5 })
    doc.font('Helvetica').fontSize(fontSize)
    const valueHeight = doc.heightOfString(printable(value), { width: valueWidth, lineGap: 0.5 })
    return Math.max(fontSize + 4, labelHeight, valueHeight) + 8
  }
  const rowsHeight = (rows: PdfRow[], fontSize: number) => rows.reduce((sum, [label, value]) => sum + rowHeight(label, value, fontSize), 0)
  const leftHeight = (fontSize: number) => sectionHeight(fontSize) * 2 + rowsHeight(studentRows, fontSize) + rowsHeight(guardianRows, fontSize) + 14
  const rightHeight = (fontSize: number) => {
    doc.font('Helvetica').fontSize(fontSize)
    const consentHeight = doc.heightOfString(consentText, { width: columnWidth - 14, lineGap: 1 })
    return sectionHeight(fontSize) * 3 + rowsHeight(emergencyRows, fontSize) + rowsHeight([['Accepted online', acceptedOnline]], fontSize)
      + rowsHeight(organizationRows, fontSize) + consentHeight + 67
  }

  // Reduce type only when unusually long entered values need the extra room.
  let bodyFont = 8.5
  while (bodyFont > 6 && Math.max(leftHeight(bodyFont), rightHeight(bodyFont)) > availableHeight) bodyFont -= 0.25

  const drawSection = (x: number, y: number, title: string) => {
    const height = sectionHeight(bodyFont)
    doc.roundedRect(x, y, columnWidth, height - 5, 5).fill(SECTION_FILL)
    doc.font('Helvetica-Bold').fontSize(bodyFont + 1).fillColor(PURPLE)
      .text(upper(title), x + 8, y + 5, { width: columnWidth - 16, lineBreak: false })
    return y + height
  }
  const drawRow = (x: number, y: number, label: string, value: unknown) => {
    const height = rowHeight(label, value, bodyFont)
    const labelWidth = 86
    doc.font('Helvetica-Bold').fontSize(bodyFont - 0.5).fillColor(MUTED)
      .text(upper(label), x + 7, y + 4, { width: labelWidth, lineGap: 0.5 })
    doc.font('Helvetica').fontSize(bodyFont).fillColor(INK)
      .text(printable(value), x + labelWidth + 7, y + 4, { width: columnWidth - labelWidth - 14, lineGap: 0.5 })
    doc.strokeColor(RULE).lineWidth(0.45).moveTo(x + 7, y + height - 2).lineTo(x + columnWidth - 7, y + height - 2).stroke()
    return y + height
  }
  const drawRows = (x: number, startY: number, rows: PdfRow[]) => rows.reduce((rowY, [label, value]) => drawRow(x, rowY, label, value), startY)

  let leftY = drawSection(leftX, bodyTop, 'Student information')
  leftY = drawRows(leftX, leftY, studentRows) + 7
  leftY = drawSection(leftX, leftY, 'Guardian information')
  drawRows(leftX, leftY, guardianRows)

  let rightY = drawSection(rightX, bodyTop, 'Emergency and medical information')
  rightY = drawRows(rightX, rightY, emergencyRows) + 7
  rightY = drawSection(rightX, rightY, 'Declaration and consent')
  doc.font('Helvetica').fontSize(bodyFont).fillColor(INK)
    .text(consentText, rightX + 7, rightY + 3, { width: columnWidth - 14, lineGap: 1 })
  rightY += doc.heightOfString(consentText, { width: columnWidth - 14, lineGap: 1 }) + 10
  rightY = drawRow(rightX, rightY, 'Accepted online', acceptedOnline)
  doc.strokeColor('#94a3b8').lineWidth(0.55).moveTo(rightX + 7, rightY + 31).lineTo(rightX + 139, rightY + 31).stroke()
  doc.moveTo(rightX + 157, rightY + 31).lineTo(rightX + columnWidth - 7, rightY + 31).stroke()
  doc.font('Helvetica').fontSize(bodyFont - 0.5).fillColor(MUTED)
    .text(upper('Applicant / guardian signature'), rightX + 7, rightY + 35, { width: 140 })
    .text(upper('Date'), rightX + 157, rightY + 35, { width: 75 })
  rightY += 57
  rightY = drawSection(rightX, rightY, 'For organization use only')
  drawRows(rightX, rightY, organizationRows)

  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text(upper(`Verify using reference ${application.referenceNumber}. This document records the application as originally submitted and is not proof of admission.`), MARGIN, 814, { width: contentWidth, align: 'center', lineBreak: false })

  doc.end()
  return complete
}
