import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'
import { eventActor, getEventDetail } from './events'
import { publicRegistrationEvent } from './public-event-registration'

const maxPdfBytes = 5 * 1024 * 1024

export async function uploadEventInvitation(http: H3Event, id: number) {
  const actor = await eventActor(http)
  const detail = await getEventDetail(actor, id)
  if (!detail.canManage) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
  const parts = await readMultipartFormData(http)
  const pdf = parts?.find(part => part.name === 'invitation' && part.filename)
  if (!pdf || pdf.type !== 'application/pdf' || !pdf.filename?.toLowerCase().endsWith('.pdf') || pdf.data.length < 5 || pdf.data.length > maxPdfBytes || pdf.data.subarray(0, 5).toString() !== '%PDF-') throw createError({ statusCode: 400, statusMessage: 'Upload a PDF invitation up to 5 MB' })
  const filename = pdf.filename.replace(/[\\/\r\n]/g, '').slice(0, 150) || 'Invitation.pdf'
  await db.insert(tables.eventInvitations).values({ eventId: id, filename, dataBase64: pdf.data.toString('base64'), uploadedBy: actor.userId }).onConflictDoUpdate({ target: tables.eventInvitations.eventId, set: { filename, dataBase64: pdf.data.toString('base64'), uploadedBy: actor.userId, uploadedAt: new Date() } })
  return { filename }
}

export async function removeEventInvitation(http: H3Event, id: number) {
  const actor = await eventActor(http)
  const detail = await getEventDetail(actor, id)
  if (!detail.canManage) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
  await db.delete(tables.eventInvitations).where(eq(tables.eventInvitations.eventId, id))
  return { removed: true }
}

export async function getEventInvitation(http: H3Event, id: number, token?: string) {
  if (token) {
    const event = await publicRegistrationEvent(http, token)
    if (event.id !== id) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  } else {
    const detail = await getEventDetail(await eventActor(http), id)
    if (!detail.canManage) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
  }
  const invitation = await db.query.eventInvitations.findFirst({ where: eq(tables.eventInvitations.eventId, id) })
  if (!invitation) throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  setHeader(http, 'Content-Type', 'application/pdf')
  setHeader(http, 'Content-Disposition', 'attachment; filename="event-invitation.pdf"')
  return Buffer.from(invitation.dataBase64, 'base64')
}
