import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'

export async function createAdmissionPdf(application: any, organization: any) {
  const doc = new PDFDocument({ margin: 46, size: 'A4', bufferPages: true, info: { Title: `Admission application ${application.referenceNumber}`, Author: organization.name } })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  const purple = '#5b21b6'
  const ink = '#172033'
  const muted = '#64748b'
  const width = doc.page.width - 92
  let y = 46
  const ensure = (height: number) => { if (y + height > doc.page.height - 70) { doc.addPage(); y = 46 } }
  const section = (title: string) => { ensure(45); doc.roundedRect(46, y, width, 26, 7).fill('#f5f3ff'); doc.font('Helvetica-Bold').fontSize(11).fillColor(purple).text(title.toUpperCase(), 58, y + 8); y += 36 }
  const row = (label: string, value?: string | null) => {
    ensure(35)
    const safe = value?.trim() || '—'
    doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text(label, 54, y, { width: 150 })
    doc.font('Helvetica').fontSize(10).fillColor(ink).text(safe, 205, y, { width: width - 165 })
    const height = Math.max(19, doc.heightOfString(safe, { width: width - 165 }) + 7)
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(54, y + height).lineTo(46 + width - 8, y + height).stroke()
    y += height + 7
  }

  doc.roundedRect(46, y, width, 104, 14).fill(purple)
  const logoPath = organization.logo ? path.join(process.cwd(), 'public', organization.logo) : null
  if (logoPath && fs.existsSync(logoPath)) {
    try { doc.roundedRect(60, y + 18, 66, 66, 12).fill('#ffffff'); doc.image(logoPath, 69, y + 27, { fit: [48, 48], align: 'center', valign: 'center' }) } catch { /* malformed images are omitted */ }
  }
  doc.font('Helvetica-Bold').fontSize(19).fillColor('#ffffff').text(organization.name, 145, y + 22, { width: 265 })
  doc.font('Helvetica').fontSize(10).fillColor('#ddd6fe').text('ADMISSION APPLICATION — PENDING APPROVAL', 145, y + 50, { width: 310 })
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(application.referenceNumber, 430, y + 24, { width: 105, align: 'right' })
  doc.font('Helvetica').fontSize(9).fillColor('#ddd6fe').text(new Date(application.submittedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }), 430, y + 44, { width: 105, align: 'right' })
  y += 122

  const photoPath = path.join(process.cwd(), 'public', application.photoPath)
  if (fs.existsSync(photoPath)) {
    try { doc.roundedRect(46, y, 104, 128, 10).strokeColor('#cbd5e1').stroke(); doc.image(photoPath, 52, y + 6, { fit: [92, 116], align: 'center', valign: 'center' }) } catch { /* malformed images are omitted */ }
  }
  doc.font('Helvetica-Bold').fontSize(18).fillColor(ink).text(`${application.firstName} ${application.lastName}`, 170, y + 12, { width: 360 })
  doc.font('Helvetica').fontSize(10).fillColor(muted).text(`Preferred dojo: ${application.dojo?.name || '—'}`, 170, y + 46)
  doc.text(`Program: ${application.program?.displayName || 'Not selected'}`, 170, y + 66)
  doc.text(`Application status: ${String(application.status).replaceAll('_', ' ')}`, 170, y + 86)
  y += 146

  section('Student information')
  row('Date of birth', new Date(application.dateOfBirth).toLocaleDateString('en-IN', { dateStyle: 'medium' }))
  row('Gender', application.gender)
  row('Email', application.email)
  row('Phone', application.phone)
  row('Address', [application.address, application.city, application.stateProvince, application.postalCode, application.country].filter(Boolean).join(', '))
  row('Preferred start date', application.preferredStartDate ? new Date(application.preferredStartDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : null)
  row('Previous experience', application.previousExperience)

  section('Guardian information')
  row('Name', application.guardianName)
  row('Relationship', application.guardianRelationship)
  row('Phone', application.guardianPhone)
  row('Email', application.guardianEmail)

  section('Emergency and medical information')
  row('Emergency contact', application.emergencyContact)
  row('Emergency phone', application.emergencyPhone)
  row('Medical notes', application.medicalNotes || 'None declared')

  const snapshot = application.formSnapshot || {}
  section('Declaration and consent')
  doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(String(snapshot.consentText || ''), 54, y, { width: width - 16, lineGap: 3 })
  y += doc.heightOfString(String(snapshot.consentText || ''), { width: width - 16, lineGap: 3 }) + 18
  row('Accepted online', new Date(application.consentAcceptedAt).toLocaleString('en-IN'))
  ensure(115)
  doc.font('Helvetica').fontSize(9).fillColor(muted).text('Applicant / guardian signature', 54, y + 52)
  doc.moveTo(54, y + 45).lineTo(285, y + 45).strokeColor('#94a3b8').stroke()
  doc.text('Date', 340, y + 52)
  doc.moveTo(340, y + 45).lineTo(530, y + 45).stroke()
  y += 80

  section('For organization use only')
  row('Physical copy received', 'Yes / No      Date: __________________')
  row('Decision', 'Approved / Rejected      Date: __________________')
  row('Authorized signature', '____________________________________________')
  doc.font('Helvetica').fontSize(8).fillColor(muted).text(`Verify using reference ${application.referenceNumber}. This document records the application as originally submitted and is not proof of admission.`, 46, doc.page.height - 48, { width, align: 'center' })
  doc.end()
  return complete
}

