import { randomBytes, randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { attendeeRequestsTransport, eventCharge } from '../../shared/utils/event-finance'
import { db, tables } from './database'
import { publicEventRegistrationSchema, validateEventAnswers } from './event-validation'
import { saveUploadedFile } from './upload'
import { formPrices, formSignature, formSnapshot } from './event-registration-forms'

const unavailable = () => { throw createError({ statusCode: 404, statusMessage: 'This event registration form is unavailable' }) }
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

export async function publicRegistrationEvent(http: H3Event, token: string) {
  return (await publicRegistrationTarget(http, token)).event
}

export async function publicRegistrationTarget(http: H3Event, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return unavailable()
  const event = await db.query.campEvents.findFirst({ where: or(and(eq(tables.campEvents.publicRegistrationToken, token), eq(tables.campEvents.publicRegistrationEnabled, true)), sql`${tables.campEvents.registrationForms} @> ${JSON.stringify([{ token, enabled: true }])}::jsonb`) })
  const tenant = http.context.tenant as { id: number } | undefined
  if (!event || event.status !== 'open' || event.registrationDeadline < today() || (tenant && tenant.id !== event.organizationId)) return unavailable()
  const form = event.registrationForms.find(item => item.token === token && item.enabled) || null
  if (!form && (!event.publicRegistrationEnabled || event.publicRegistrationToken !== token)) return unavailable()
  return { event, form }
}

export async function publicRegistrationForm(http: H3Event, token: string) {
  const { event, form } = await publicRegistrationTarget(http, token)
  const [organization, dojos, invitation] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(tables.organizations.id, event.organizationId), columns: { name: true, logo: true } }),
    event.registrationMode === 'public' ? Promise.resolve([]) : db.query.dojos.findMany({ where: and(eq(tables.dojos.organizationId, event.organizationId), event.dojoIds.length ? inArray(tables.dojos.id, event.dojoIds) : undefined), columns: { id: true, name: true, city: true } }),
    db.query.eventInvitations.findFirst({ where: eq(tables.eventInvitations.eventId, event.id), columns: { filename: true } }),
  ])
  return {
    organization: { name: organization?.name || '', logo: organization?.logo || null },
    event: { name: event.name, description: event.description, venue: event.venue, startDate: event.startDate, endDate: event.endDate, registrationDeadline: event.registrationDeadline, detailsDeadline: event.detailsDeadline, registrationMode: event.registrationMode, transportProvided: event.transportProvided, prices: form ? formPrices(form) : event.prices, registrationForm: form ? formSnapshot(form) : null, formSignature: form ? formSignature(form) : null, currency: event.currency, confirmationRule: event.confirmationRule, deposit: event.deposit, terms: event.terms, instructions: event.instructions, formSettings: event.formSettings, invitationFilename: invitation?.filename || null },
    dojos,
  }
}

export async function submitPublicEventRegistration(http: H3Event, token: string, input: unknown, photo?: { data: Buffer, type?: string }, additionalPhotos: { index: number, data: Buffer, type?: string }[] = []) {
  const result = publicEventRegistrationSchema.safeParse(input)
  if (!result.success) throw createError({ statusCode: 400, statusMessage: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') })
  const body = result.data
  const { event } = await publicRegistrationTarget(http, token)
  const savedPhotoPaths: string[] = []
  try { return await db.transaction(async tx => {
    const [locked] = await tx.select().from(tables.campEvents).where(eq(tables.campEvents.id, event.id)).for('update')
    const selectedForm = locked?.registrationForms.find(item => item.token === token && item.enabled) || null
    if (!locked || (!selectedForm && (!locked.publicRegistrationEnabled || locked.publicRegistrationToken !== token)) || locked.status !== 'open' || locked.registrationDeadline < today()) return unavailable()
    const [prior] = await tx.select().from(tables.eventRegistrationRequests).where(and(eq(tables.eventRegistrationRequests.eventId, locked.id), eq(tables.eventRegistrationRequests.requestKey, body.requestKey)))
    if (prior) return { reference: prior.reference, status: prior.status, printToken: prior.printToken, physicalCopyInstructions: prior.physicalCopyRequired ? prior.physicalCopyInstructions : '' }
    if (selectedForm && body.formSignature !== formSignature(selectedForm)) throw createError({ statusCode: 409, statusMessage: 'This form fee or inclusions changed. Reload the page and review the updated price before submitting.' })
    if (locked.registrationMode === 'public' && body.dojoId !== null) throw createError({ statusCode: 400, statusMessage: 'Public event registration cannot link to a dojo' })
    if (locked.registrationMode === 'public' && (!body.sourceCity || !body.sourceState || !body.instructorName)) throw createError({ statusCode: 400, statusMessage: 'Enter city, state and instructor name' })
    const students = body.attendees.filter(person => person.type === 'student')
    if (selectedForm && !(students[0]?.currentGrade || body.currentGrade)) throw createError({ statusCode: 400, statusMessage: 'Enter the student current grade or belt' })
    if (locked.registrationMode === 'linked' && students.length !== 1) throw createError({ statusCode: 400, statusMessage: 'Linked event forms accept one student' })
    if (locked.registrationMode === 'public' && students.some((person, index) => !(person.dateOfBirth || (index === 0 && body.dateOfBirth)))) throw createError({ statusCode: 400, statusMessage: 'Enter a birth date for every student' })
    if (selectedForm && students.some((person, index) => !(person.currentGrade || (index === 0 && body.currentGrade)))) throw createError({ statusCode: 400, statusMessage: 'Enter the current grade or belt for every student' })
    if (!selectedForm && !locked.transportProvided && body.attendees.some(attendeeRequestsTransport)) throw createError({ statusCode: 400, statusMessage: 'Transport is not provided for this event' })
    if (!selectedForm && body.attendees.some(person => person.underFive)) throw createError({ statusCode: 400, statusMessage: 'The under-five concession is not available on this form' })
    if (locked.registrationMode === 'linked' && body.attendees.length > 3) throw createError({ statusCode: 400, statusMessage: 'At most two accompanying people may register on this linked event form' })
    if (selectedForm) for (const person of body.attendees) {
      if (person.type === 'student' && person.underFive) throw createError({ statusCode: 400, statusMessage: 'The under-five concession applies to accompanying people only' })
      if (person.underFive) {
        if (!person.dateOfBirth || person.dateOfBirth > today() || person.dateOfBirth > locked.startDate) throw createError({ statusCode: 400, statusMessage: 'Enter a valid birth date for each under-five companion' })
        const fifthBirthday = new Date(`${person.dateOfBirth}T00:00:00Z`)
        fifthBirthday.setUTCFullYear(fifthBirthday.getUTCFullYear() + 5)
        if (fifthBirthday.toISOString().slice(0, 10) <= locked.startDate) throw createError({ statusCode: 400, statusMessage: 'The under-five concession requires the companion to be under five on the event start date' })
      }
    }
    const sourceType = locked.registrationMode === 'public' ? 'external' : body.sourceType
    const dojo = locked.registrationMode === 'linked' && sourceType === 'internal' && body.dojoId ? await tx.query.dojos.findFirst({ where: and(eq(tables.dojos.id, body.dojoId), eq(tables.dojos.organizationId, locked.organizationId)) }) : null
    if (locked.registrationMode === 'linked' && sourceType === 'internal' && (!dojo || (locked.dojoIds.length && !locked.dojoIds.includes(dojo.id)))) throw createError({ statusCode: 400, statusMessage: 'Choose an eligible dojo' })
    if (locked.registrationMode === 'linked' && sourceType === 'external' && (!body.sourceDojoName || !body.sourceState || !body.sourceCountry)) throw createError({ statusCode: 400, statusMessage: 'Enter your dojo or school, state and country' })
    const customAnswers = validateEventAnswers(locked.formSettings, body.customAnswers)
    if (additionalPhotos.some((item, index) => item.index < 1 || item.index >= students.length || additionalPhotos.findIndex(other => other.index === item.index) !== index)) throw createError({ statusCode: 400, statusMessage: 'Invalid student photograph list' })
    const uploadedPhotoPaths: (string | null)[] = []
    for (let index = 0; index < students.length; index++) {
      const selectedPhoto = index === 0 ? photo : additionalPhotos.find(item => item.index === index)
      if (locked.formSettings.requirePhoto && !selectedPhoto?.data?.length) throw createError({ statusCode: 400, statusMessage: `Take or upload student photograph ${index + 1}` })
      if (!selectedPhoto?.data?.length) { uploadedPhotoPaths.push(null); continue }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedPhoto.type || '') || selectedPhoto.data.length > 5 * 1024 * 1024) throw createError({ statusCode: 400, statusMessage: 'Use a JPG, PNG, or WebP photograph up to 5 MB' })
      let normalized: Buffer
      try { const source = sharp(selectedPhoto.data, { limitInputPixels: 16_000_000 }); const metadata = await source.metadata(); if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) throw new Error('Unsupported image'); normalized = await source.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer() }
      catch { throw createError({ statusCode: 400, statusMessage: 'The photograph could not be read' }) }
      const uploaded = await saveUploadedFile({ name: 'photo', filename: 'student.jpg', data: normalized, type: 'image/jpeg' }, 'event-photos', ['image/jpeg'])
      savedPhotoPaths.push(uploaded.path)
      uploadedPhotoPaths.push(uploaded.path)
    }
    let studentIndex = 0
    const attendees = body.attendees.map(person => ({ ...person, meal: '',
      ...(person.type === 'student' ? { dateOfBirth: person.dateOfBirth || (studentIndex === 0 ? body.dateOfBirth : ''), currentGrade: person.currentGrade || (studentIndex === 0 ? body.currentGrade : ''), membershipNumber: person.membershipNumber || (studentIndex === 0 ? body.membershipNumber : ''), photoPath: uploadedPhotoPaths[studentIndex++] || undefined } : {}),
      ...(selectedForm ? { underFive: person.type === 'parent' && person.underFive, accommodation: selectedForm.includesAccommodation, transportOut: selectedForm.includesTransportOut, transportReturn: selectedForm.includesTransportReturn, busOut: '', busReturn: '', room: '' } : {}),
      id: randomUUID(), studentId: null, checkedInAt: null }))
    const prices = selectedForm ? formPrices(selectedForm) : locked.prices
    const studentName = attendees.find(person => person.type === 'student')!.name
    const [saved] = await tx.insert(tables.eventRegistrationRequests).values({
      eventId: locked.id, requestKey: body.requestKey, reference: `EVR-${randomUUID().slice(0, 10).toUpperCase()}`,
      studentName, dateOfBirth: attendees.find(person => person.type === 'student')!.dateOfBirth, membershipNumber: attendees.find(person => person.type === 'student')!.membershipNumber, currentGrade: attendees.find(person => person.type === 'student')!.currentGrade, dojoId: locked.registrationMode === 'public' ? null : dojo?.id || null,
      sourceType, sourceDojoName: dojo?.name || body.sourceDojoName, sourceCity: dojo?.city || body.sourceCity, sourceState: dojo?.stateProvince || body.sourceState, sourceCountry: dojo?.country || body.sourceCountry, instructorName: body.instructorName,
      contactName: body.contactName, contactPhone: body.contactPhone, emergencyName: body.emergencyName, emergencyPhone: body.emergencyPhone,
      attendees, consent: { ...body.consent, terms: locked.terms, acceptedAt: new Date().toISOString() },
      prices, registrationForm: selectedForm ? formSnapshot(selectedForm) : null, notes: body.notes, waitlist: body.waitlist, customAnswers,
      photoPath: uploadedPhotoPaths[0] || null, printToken: randomBytes(32).toString('hex'),
      physicalCopyRequired: Boolean(locked.formSettings.requirePhysicalCopy), physicalCopyInstructions: locked.formSettings.physicalCopyInstructions || '',
    }).returning()
    return { reference: saved!.reference, status: saved!.status, quote: eventCharge(attendees, prices).total, printToken: saved!.printToken, physicalCopyInstructions: saved!.physicalCopyRequired ? saved!.physicalCopyInstructions : '' }
  }) } catch (error) { await Promise.all(savedPhotoPaths.map(path => unlink(join(process.cwd(), 'public', path)).catch(() => {}))); throw error }
}
