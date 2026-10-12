import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import { eq } from 'drizzle-orm'
import { db, tables } from './database'
import { attendeeRequestsTransport, eventCharge } from '../../shared/utils/event-finance'
import { formatAmount } from './currency'

async function image(path: string | null, folder: 'logos' | 'event-photos') {
  if (!path || !new RegExp(`^/uploads/${folder}/[a-f0-9-]+\\.(?:png|jpe?g|gif|webp|svg)$`, 'i').test(path)) return null
  try { return await sharp(await readFile(join(process.cwd(), 'public', path)), { limitInputPixels: 16_000_000 }).resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).png().toBuffer() } catch { return null }
}

export async function eventRegistrationPdf(printToken: string) {
  if (!/^[a-f0-9]{64}$/.test(printToken)) throw createError({ statusCode: 404, statusMessage: 'Registration not found' })
  const request = await db.query.eventRegistrationRequests.findFirst({ where: eq(tables.eventRegistrationRequests.printToken, printToken) })
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Registration not found' })
  const event = await db.query.campEvents.findFirst({ where: eq(tables.campEvents.id, request.eventId) })
  const organization = event && await db.query.organizations.findFirst({ where: eq(tables.organizations.id, event.organizationId), columns: { name: true, logo: true } })
  if (!event || !organization) throw createError({ statusCode: 404, statusMessage: 'Registration not found' })

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Event registration ${request.reference}`, Author: organization.name } })
  const chunks: Buffer[] = []
  const output = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const accent = /^#[0-9a-f]{6}$/i.test(event.formSettings.accentColor) ? event.formSettings.accentColor : '#0f766e'
  doc.rect(0, 0, 595, 110).fill(accent)
  const logo = await image(organization.logo, 'logos')
  if (logo) { try { doc.image(logo, 48, 25, { fit: [58, 58] }) } catch { /* keep text heading */ } }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(organization.name, logo ? 120 : 48, 36, { width: logo ? 425 : 500 })
  doc.fontSize(10).font('Helvetica').text('EVENT REGISTRATION APPLICATION', logo ? 120 : 48, 67, { width: 420 })
  doc.y = 138
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(17).text(event.name)
  doc.moveDown(0.35).font('Helvetica').fontSize(10).text(`Reference: ${request.reference}    Submitted: ${request.createdAt.toLocaleDateString('en-IN')}`)
  doc.text(`Dates: ${event.startDate} to ${event.endDate}${event.venue ? `    Venue: ${event.venue}` : ''}`)
  const photo = await image(request.photoPath, 'event-photos')
  const photoY = doc.y + 14
  if (photo) { try { doc.image(photo, 445, photoY, { fit: [100, 125] }) } catch { /* omit unreadable photo */ } }
  const field = (label: string, value: unknown, width = 380) => { doc.font('Helvetica-Bold').text(`${label}: `, { continued: true, width }); doc.font('Helvetica').text(String(value || '—'), { width }) }
  doc.moveDown(1).fontSize(10)
  field('Student', request.studentName)
  field('Date of birth', request.dateOfBirth)
  if (request.currentGrade) field('Current grade / belt', request.currentGrade)
  if (request.registrationForm) {
    field('Registration package', request.registrationForm.name)
    field('Included', [request.registrationForm.includesTraining && 'training', request.registrationForm.includesMeals && 'meals', request.registrationForm.includesAccommodation && 'accommodation', request.registrationForm.includesTransportOut && 'outward transport', request.registrationForm.includesTransportReturn && 'return transport'].filter(Boolean).join(', ') || 'participation only')
  }
  field('Membership number', request.membershipNumber)
  field('From', [request.sourceDojoName, request.sourceCity, request.sourceState, request.sourceCountry].filter(Boolean).join(', '))
  if (request.instructorName) field('Instructor', request.instructorName)
  field('Contact', `${request.contactName} · ${request.contactPhone}`)
  field('Emergency contact', `${request.emergencyName} · ${request.emergencyPhone}`)
  if (!event.transportProvided && !request.attendees.some(attendeeRequestsTransport)) doc.moveDown(0.4).text('Travel is arranged by students and parents. The organizer does not provide transport.')
  doc.y = Math.max(doc.y + 8, photoY + (photo ? 135 : 0))
  const heading = (value: string) => { doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fillColor(accent).text(value); doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#0f172a') }
  heading('Participants and services')
  for (const person of request.attendees) {
    const services = [person.transportOut && 'outward transport', person.transportReturn && 'return transport', person.accommodation && 'accommodation'].filter(Boolean).join(', ') || 'no optional services'
    doc.text(`${person.type === 'student' ? 'Student' : 'Accompanying person'}: ${person.name || 'Name pending'}${person.relationship ? ` (${person.relationship})` : ''}${person.underFive ? `, under 5 (${person.dateOfBirth || 'birth date pending'}), no fee` : ''} — ${services}`)
    if (person.meal) doc.text(`Meal: ${person.meal}`)
    if (person.medicalNotes) doc.text(`Needs: ${person.medicalNotes}`)
  }
  if (request.customAnswers.length) {
    heading('Additional answers')
    for (const answer of request.customAnswers) field(answer.label, typeof answer.value === 'boolean' ? (answer.value ? 'Yes' : 'No') : answer.value, 490)
  }
  if (request.notes) { heading('Applicant notes'); doc.text(request.notes) }
  heading('Fee estimate and declaration')
  doc.text(`Estimated fee: ${formatAmount(eventCharge(request.attendees, request.prices).total, event.currency)}. Payment status is recorded separately by the organizer.`)
  doc.moveDown(0.4).text(`Consent given online by ${request.consent.name} (${request.consent.phone}) on ${request.consent.acceptedAt ? new Date(request.consent.acceptedAt).toLocaleString('en-IN') : request.createdAt.toLocaleString('en-IN')}.`)
  if (request.consent.terms) doc.moveDown(0.4).text(`Accepted terms: ${request.consent.terms}`, { width: 495 })
  if (request.physicalCopyRequired && request.physicalCopyInstructions) doc.moveDown(0.5).font('Helvetica-Bold').text(request.physicalCopyInstructions)
  if (doc.y > 700) doc.addPage()
  doc.moveDown(2).font('Helvetica').text('Applicant / parent / guardian signature: ____________________________________')
  doc.moveDown(1).text('Date: ____________________    Organizer receipt: ____________________')
  doc.end()
  return { buffer: await output, reference: request.reference }
}
