import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'
import { eventActor, getEventDetail } from './events'
import { publicRegistrationEvent } from './public-event-registration'
import { formatAmount } from './currency'

async function logoImage(logo: string | null) {
  if (!logo || !/^\/uploads\/logos\/[a-f0-9-]+\.(png|jpe?g|gif|webp|svg)$/i.test(logo)) return null
  try { return await sharp(await readFile(join(process.cwd(), 'public', logo)), { limitInputPixels: 4_000_000 }).resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true }).png().toBuffer() } catch { return null }
}
function readableAccent(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return '#0f766e'
  const parts = [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16))
  if ((parts[0]! * 0.2126 + parts[1]! * 0.7152 + parts[2]! * 0.0722) < 135) return color
  return `#${parts.map(part => Math.round(part * 0.45).toString(16).padStart(2, '0')).join('')}`
}

export async function brandedEventInvitation(http: H3Event, id: number, token?: string) {
  const event = token ? await publicRegistrationEvent(http, token) : (await getEventDetail(await eventActor(http), id)).event
  if (event.id !== id) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, event.organizationId), columns: { name: true, logo: true } })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  const settings = event.formSettings
  const doc = new PDFDocument({ size: 'A4', margin: 56 })
  const chunks: Buffer[] = []
  const output = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const accent = readableAccent(settings.accentColor)
  doc.rect(0, 0, 595, 110).fill(accent)
  const logo = await logoImage(organization.logo)
  if (logo) { try { doc.image(logo, 56, 26, { fit: [64, 56] }) } catch { /* An unsupported image still leaves the organization name visible. */ } }
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(organization.name, logo ? 132 : 56, 42, { width: logo ? 408 : 483 })
  doc.y = 148
  doc.fillColor(accent).fontSize(22).text(settings.letterHeading || 'Invitation to participate')
  doc.moveDown(0.8).fillColor('#0f172a').fontSize(16).text(event.name)
  doc.moveDown(0.7).font('Helvetica').fontSize(11)
  doc.text(`Dates: ${event.startDate} to ${event.endDate}`)
  if (event.venue) doc.text(`Venue: ${event.venue}`)
  doc.text(`Registration closes: ${event.registrationDeadline}`)
  doc.moveDown()
  doc.text(settings.letterBody || `You are invited to participate in ${event.name}. Any student may register alone or with up to two accompanying parents. Event registration does not require a dojo account.`, { align: 'left' })
  doc.moveDown()
  doc.font('Helvetica-Bold').text('Participation and registration').font('Helvetica')
  doc.text(`Student fee: ${formatAmount(event.prices.student, event.currency)} | Parent fee: ${formatAmount(event.prices.parent, event.currency)} per person. Optional transport and accommodation are quoted on the registration form.`)
  const publicToken = token || ('publicRegistrationToken' in event ? event.publicRegistrationToken : null)
  if (event.publicRegistrationEnabled && publicToken) {
    const link = `${getRequestURL(http).origin}/event-registration/${publicToken}`
    doc.moveDown().fillColor(accent).font('Helvetica-Bold').text('Register online:').font('Helvetica').text(link, { link, underline: true })
  }
  if (settings.contactText) doc.moveDown().fillColor('#0f172a').text(settings.contactText)
  doc.moveDown(1.3).fillColor('#475569').fontSize(9).text('Submitting the form sends a request for organizer review. A place is reserved only after the request is approved.')
  doc.end()
  setHeader(http, 'Content-Type', 'application/pdf')
  setHeader(http, 'Content-Disposition', 'attachment; filename="event-invitation.pdf"')
  return output
}
