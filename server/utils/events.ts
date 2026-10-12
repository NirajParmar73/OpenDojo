import { randomBytes, randomUUID } from 'node:crypto'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'
import { getAccessibleDojoIds } from './permissions'
import { attendeeRequestsTransport, bookingBalance, bookingMissingDetails, bookingPaymentStatus, capacityProblem, eventCharge, eventFinancials, eventOccupancy, reservingStatuses } from '../../shared/utils/event-finance'
import type { EventAnswer, EventAttendee, EventGuestProfile, EventPrices, EventRegistrationFormSnapshot } from '../../shared/types/events'
import { bookingSchema, bookingUpdateSchema, costSchema, costUpdateSchema, eventRequestCorrectionSchema, eventSchema, ledgerSchema } from './event-validation'
import { z } from 'zod'

type Camp = typeof tables.campEvents.$inferSelect
type Booking = typeof tables.eventBookings.$inferSelect
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
const managerRoles = ['owner', 'admin', 'country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head']
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const fail = (message: string, statusCode = 400): never => { throw createError({ statusCode, statusMessage: message }) }
function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input)
  if (!result.success) return fail(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  return result.data
}

export async function eventActor(http: H3Event, portal = false) {
  const { user } = await getUserSession(http)
  if (!user?.organizationId) return fail('Sign in to continue', 401)
  if ((user.role === 'student') !== portal) return fail('This area is not available to this account', 403)
  const studentId = portal ? Number((user as unknown as { studentId: number }).studentId) : null
  const student = studentId ? await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, user.organizationId)) }) : null
  if (portal && !student) return fail('Student not found', 404)
  const dojoIds = portal ? (student?.dojoId ? [student.dojoId] : []) : await getAccessibleDojoIds(user.id, user.organizationId)
  return { organizationId: user.organizationId, userId: portal ? null : user.id, studentId, student, dojoIds, portal, manager: !portal && managerRoles.includes(user.role), label: `${portal ? 'Student' : 'Staff'} ${user.id}: ${user.name}` }
}
type Actor = Awaited<ReturnType<typeof eventActor>>

export function canManageEvent(actor: Actor, event: Pick<Camp, 'dojoIds' | 'registrationMode'>) {
  return actor.manager && (event.registrationMode === 'public' ? actor.dojoIds === null : actor.dojoIds === null || (event.dojoIds.length > 0 && event.dojoIds.every(id => actor.dojoIds!.includes(id))))
}
function visible(actor: Actor, event: Camp) {
  if (event.registrationMode === 'public') return canManageEvent(actor, event)
  return (!actor.portal || event.status !== 'draft') && (!event.dojoIds.length || actor.dojoIds === null || event.dojoIds.some(id => actor.dojoIds!.includes(id)))
}
function ownsBooking(actor: Actor, booking: Booking) {
  return actor.portal ? booking.studentId === actor.studentId : actor.dojoIds === null || (booking.dojoId !== null && actor.dojoIds.includes(booking.dojoId))
}
function publicEvent(event: Camp) {
  const { fixedBudget: _a, perPersonBudget: _b, overheadBudget: _c, createdBy: _d, publicRegistrationToken: _e, registrationForms: _f, ...publicFields } = event
  return publicFields
}
async function eventRecord(actor: Actor, id: number, tx: Tx | typeof db = db, lock = false) {
  if (!Number.isSafeInteger(id) || id <= 0) return fail('Invalid event ID')
  const query = tx.select().from(tables.campEvents).where(and(eq(tables.campEvents.id, id), eq(tables.campEvents.organizationId, actor.organizationId)))
  const [event] = await (lock ? query.for('update') : query)
  if (!event) return fail('Event not found', 404)
  return event
}
async function audit(tx: Tx, actor: Actor, eventId: number, action: string, details: string, bookingId?: number) {
  await tx.insert(tables.eventActivity).values({ eventId, actor: actor.label, action, details, bookingId: bookingId || null })
}
async function records(eventId: number, tx: Tx | typeof db = db) {
  const [bookings, ledger, costs] = await Promise.all([
    tx.select().from(tables.eventBookings).where(eq(tables.eventBookings.eventId, eventId)).orderBy(desc(tables.eventBookings.createdAt)),
    tx.select().from(tables.eventLedger).where(eq(tables.eventLedger.eventId, eventId)).orderBy(desc(tables.eventLedger.id)),
    tx.select().from(tables.eventCosts).where(eq(tables.eventCosts.eventId, eventId)).orderBy(desc(tables.eventCosts.id)),
  ])
  return { bookings, ledger, costs }
}

export async function listEvents(actor: Actor) {
  const all = await db.select().from(tables.campEvents).where(eq(tables.campEvents.organizationId, actor.organizationId)).orderBy(desc(tables.campEvents.startDate))
  const mine = actor.studentId ? await db.select().from(tables.eventBookings).where(eq(tables.eventBookings.studentId, actor.studentId)) : []
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, actor.organizationId), columns: { currency: true } })
  const events = []
  for (const event of all.filter(item => visible(actor, item) || mine.some(booking => booking.eventId === item.id))) {
    const { bookings, ledger, costs } = await records(event.id)
    const manager = canManageEvent(actor, event)
    events.push({ ...(manager ? event : publicEvent(event)), canManage: manager, occupancy: eventOccupancy(bookings), bookingCount: bookings.filter(booking => ownsBooking(actor, booking)).length, finances: manager ? eventFinancials(event, bookings, costs, ledger) : null })
  }
  return { events, canCreate: actor.manager && actor.dojoIds === null, currency: organization?.currency || 'INR' }
}

export async function getEventDetail(actor: Actor, id: number) {
  const event = await eventRecord(actor, id)
  const { bookings, ledger, costs } = await records(id)
  const manager = canManageEvent(actor, event)
  if (!visible(actor, event) && !bookings.some(booking => actor.portal && ownsBooking(actor, booking))) return fail('Event not found', 404)
  const allowed = bookings.filter(booking => manager || ownsBooking(actor, booking))
  const bookingIds = allowed.map(booking => booking.id)
  const students = event.registrationMode === 'public' ? [] : actor.portal ? actor.student ? [actor.student] : [] : await db.query.students.findMany({ where: and(eq(tables.students.organizationId, actor.organizationId), actor.dojoIds === null ? undefined : actor.dojoIds.length ? inArray(tables.students.dojoId, actor.dojoIds) : eq(tables.students.id, -1)) })
  const studentIds = students.map(student => student.id)
  const guardians = studentIds.length ? await db.select().from(tables.guardians).where(inArray(tables.guardians.studentId, studentIds)) : []
  const requests = manager ? await db.select().from(tables.eventRegistrationRequests).where(eq(tables.eventRegistrationRequests.eventId, id)).orderBy(desc(tables.eventRegistrationRequests.id)) : []
  const invitation = manager ? await db.query.eventInvitations.findFirst({ where: eq(tables.eventInvitations.eventId, id), columns: { filename: true, uploadedAt: true } }) : null
  const active = bookings.filter(booking => reservingStatuses.includes(booking.status as 'pending'))
  return {
    event: manager ? event : publicEvent(event), canManage: manager, portal: actor.portal,
    occupancy: eventOccupancy(bookings),
    bookings: allowed.map(booking => ({ ...booking, balance: bookingBalance(booking, ledger), paymentStatus: bookingPaymentStatus(booking, ledger), missing: bookingMissingDetails(booking) })),
    ledger: manager ? ledger : ledger.filter(row => row.bookingId && bookingIds.includes(row.bookingId)).map(({ createdBy: _actor, requestKey: _key, ...row }) => row),
    costs: manager ? costs : [], finances: manager ? eventFinancials(event, bookings, costs, ledger) : null,
    activity: manager ? await db.select().from(tables.eventActivity).where(eq(tables.eventActivity.eventId, id)).orderBy(desc(tables.eventActivity.id)).limit(100) : [],
    registrationRequests: requests, invitation,
    registrationSummary: manager ? { submitted: requests.filter(request => request.status === 'submitted').length, approved: requests.filter(request => request.status === 'approved').length, rejected: requests.filter(request => request.status === 'rejected').length, enrolledStudents: eventOccupancy(bookings).students, internalStudents: active.filter(booking => booking.studentId !== null).reduce((sum, booking) => sum + booking.attendees.filter(person => person.type === 'student').length, 0), guestStudents: active.filter(booking => booking.studentId === null).reduce((sum, booking) => sum + booking.attendees.filter(person => person.type === 'student').length, 0), waitlistedStudents: bookings.filter(booking => booking.status === 'waitlisted').reduce((sum, booking) => sum + booking.attendees.filter(person => person.type === 'student').length, 0), parents: eventOccupancy(bookings).parents, paidBookings: active.filter(booking => bookingPaymentStatus(booking, ledger) === 'paid').length, partPaidBookings: active.filter(booking => bookingPaymentStatus(booking, ledger) === 'part_paid').length, pendingFeeBookings: active.filter(booking => bookingPaymentStatus(booking, ledger) === 'pending').length } : null,
    students: students.filter(student => student.status === 'active' && (!event.dojoIds.length || (student.dojoId && event.dojoIds.includes(student.dojoId)))).map(student => ({ id: student.id, name: `${student.firstName} ${student.lastName}`, phone: student.phone || '', dojoId: student.dojoId, membershipNumber: student.membershipNumber || '', dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) || null, emergencyContact: student.emergencyContact || '', emergencyPhone: student.emergencyPhone || '', guardians: guardians.filter(guardian => guardian.studentId === student.id).map(guardian => ({ id: guardian.id, name: guardian.name, relationship: guardian.relationship, phone: guardian.phone || '', email: guardian.email || '' })) })),
  }
}

export async function saveEvent(actor: Actor, input: unknown, id?: number) {
  const body = validate(eventSchema, input)
  if (!id && !canManageEvent(actor, body)) return fail('Only organization administrators can create public events', 403)
  if (body.dojoIds.length) {
    const dojos = await db.select({ id: tables.dojos.id }).from(tables.dojos).where(and(eq(tables.dojos.organizationId, actor.organizationId), inArray(tables.dojos.id, body.dojoIds)))
    if (new Set(body.dojoIds).size !== dojos.length) return fail('Invalid dojo selection')
  }
  return db.transaction(async tx => {
    if (id) {
      const previous = await eventRecord(actor, id, tx, true)
      if (!canManageEvent(actor, previous)) return fail('You cannot manage this event', 403)
      if (body.registrationMode !== previous.registrationMode && (input as Record<string, unknown>)?.registrationMode !== undefined) return fail('The registration mode cannot change after an event is created')
      body.registrationMode = previous.registrationMode === 'public' ? 'public' : 'linked'
      if ((input as Record<string, unknown>)?.transportProvided === undefined) body.transportProvided = previous.transportProvided
      if (body.registrationMode === 'public' && body.dojoIds.length) return fail('Public events belong to the organization, not individual dojos')
      const { bookings, costs } = await records(id, tx)
      if (!body.transportProvided) {
        if (previous.registrationForms.some(form => form.enabled && (form.includesTransportOut || form.includesTransportReturn))) return fail('Disable transport on each active registration form first')
        if (bookings.some(booking => booking.status !== 'cancelled' && booking.attendees.some(attendeeRequestsTransport))) return fail('Remove or cancel existing transport bookings before disabling transport')
        const requests = await tx.select({ status: tables.eventRegistrationRequests.status, attendees: tables.eventRegistrationRequests.attendees }).from(tables.eventRegistrationRequests).where(eq(tables.eventRegistrationRequests.eventId, id))
        if (requests.some(request => request.status === 'submitted' && request.attendees.some(attendeeRequestsTransport))) return fail('Review or reject transport requests before disabling transport')
      }
      if (!body.transportProvided) { body.outboundCapacity = 0; body.returnCapacity = 0; body.prices.transportOut = 0; body.prices.transportReturn = 0 }
      const problem = capacityProblem(eventOccupancy(bookings), body)
      if (problem) return fail(problem)
      if (bookings.length && JSON.stringify([...body.dojoIds].sort()) !== JSON.stringify([...previous.dojoIds].sort())) return fail('Keep the event dojo scope unchanged after bookings exist')
      if (body.status === 'cancelled' && bookings.some(booking => booking.status !== 'cancelled')) return fail('Cancel each booking and decide its retained fee before cancelling the event')
      if (body.status === 'draft' && bookings.length) return fail('An event with bookings cannot return to draft')
      if (body.status === 'completed' && (bookings.some(booking => ['provisional', 'pending', 'waitlisted'].includes(booking.status)) || costs.some(cost => cost.status === 'committed'))) return fail('Resolve pending bookings and mark supplier costs incurred or cancelled before completing the event')
      const [saved] = await tx.update(tables.campEvents).set({ ...body, updatedAt: new Date() }).where(eq(tables.campEvents.id, id)).returning()
      await audit(tx, actor, id, 'event.updated', `${body.name}: ${body.status}`)
      return saved
    }
    if (body.registrationMode !== 'public') return fail('New events use organization-wide public registration')
    if (body.status === 'completed' || body.status === 'cancelled') return fail('Create the event as a draft or open event')
    if (body.registrationMode === 'public' && body.dojoIds.length) return fail('Public events belong to the organization, not individual dojos')
    if (!body.transportProvided) { body.outboundCapacity = 0; body.returnCapacity = 0; body.prices.transportOut = 0; body.prices.transportReturn = 0 }
    const organization = await tx.query.organizations.findFirst({ where: eq(tables.organizations.id, actor.organizationId) })
    const [saved] = await tx.insert(tables.campEvents).values({ ...body, organizationId: actor.organizationId, currency: organization?.currency || 'INR', createdBy: actor.userId }).returning()
    await audit(tx, actor, saved!.id, 'event.created', body.name)
    return saved
  })
}

export async function deleteUnusedEvent(actor: Actor, id: number) {
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can delete an unused event', 403)
    const { bookings, costs, ledger } = await records(id, tx)
    const [request] = await tx.select({ id: tables.eventRegistrationRequests.id }).from(tables.eventRegistrationRequests).where(eq(tables.eventRegistrationRequests.eventId, id)).limit(1)
    if (bookings.length || costs.length || ledger.length || request) return fail('This event has registration or financial history. Cancel it instead of deleting it.', 409)
    await tx.delete(tables.campEvents).where(eq(tables.campEvents.id, id))
    return { deleted: true }
  })
}

async function saveGuardians(tx: Tx, booking: Booking) {
  if (!booking.studentId) return
  const existing = await tx.select().from(tables.guardians).where(eq(tables.guardians.studentId, booking.studentId))
  for (const person of booking.attendees.filter(person => person.type === 'parent' && person.name && person.relationship)) {
    if (existing.some(guardian => guardian.name.toLowerCase() === person.name.toLowerCase() && guardian.relationship.toLowerCase() === person.relationship.toLowerCase())) continue
    await tx.insert(tables.guardians).values({ studentId: booking.studentId, name: person.name, relationship: person.relationship, phone: person.phone || null, email: person.email || null })
  }
}
function normalizeAttendees(input: { id?: string, type: 'student' | 'parent', underFive?: boolean, dateOfBirth?: string, currentGrade?: string, membershipNumber?: string, photoPath?: string, name: string, relationship: string, phone: string, email: string, meal: string, medicalNotes: string, transportOut: boolean, transportReturn: boolean, accommodation: boolean, room: string, busOut: string, busReturn: string }[], student: { id: number, firstName: string, lastName: string } | null, previous: EventAttendee[] = [], portal = false) {
  const studentCount = input.filter(person => person.type === 'student').length
  if (student ? studentCount !== 1 : studentCount < 1 || studentCount > 10 || input.length - studentCount > 10) return fail(student ? 'Select exactly one linked student' : 'Select one to ten students and up to ten accompanying people')
  const result = input.map(person => {
    const old = previous.find(item => item.id === person.id)
    if (person.id && !old) return fail('Attendee has changed; refresh the booking')
    return { ...person, underFive: person.underFive ?? old?.underFive ?? false, dateOfBirth: person.dateOfBirth || old?.dateOfBirth || '', currentGrade: person.currentGrade || old?.currentGrade || '', membershipNumber: person.membershipNumber || old?.membershipNumber || '', photoPath: old?.photoPath || person.photoPath, id: old?.id || randomUUID(), studentId: person.type === 'student' ? student?.id || null : null, name: person.type === 'student' && student ? `${student.firstName} ${student.lastName}` : person.name, room: portal ? old?.room || '' : person.room, busOut: portal ? old?.busOut || '' : person.busOut, busReturn: portal ? old?.busReturn || '' : person.busReturn, checkedInAt: old?.checkedInAt || null }
  })
  if (new Set(result.map(person => person.id)).size !== result.length) return fail('Duplicate attendee')
  return result
}
function automaticStatus(event: Camp, booking: Booking, ledger: typeof tables.eventLedger.$inferSelect[]) {
  if (event.status === 'completed') return booking.status
  if (['cancelled', 'waitlisted'].includes(booking.status)) return booking.status
  if (bookingMissingDetails(booking).length) return 'provisional'
  const balance = bookingBalance(booking, ledger)
  if (event.confirmationRule === 'full' && balance.outstanding === 0) return 'confirmed'
  if (event.confirmationRule === 'deposit' && balance.paid >= Math.min(event.deposit, balance.total)) return 'confirmed'
  return booking.status === 'confirmed' && event.confirmationRule === 'staff' ? 'confirmed' : 'pending'
}

type BookingInput = z.output<typeof bookingSchema>
async function createEventBookingInTx(tx: Tx, actor: Actor, id: number, body: BookingInput, priceSnapshot?: EventPrices, review = false, termsSnapshot?: string, customAnswers: EventAnswer[] = [], registrationForm: EventRegistrationFormSnapshot | null = null) {
  if (actor.portal && (body.studentId !== actor.studentId || body.discount)) return fail('You can register only your own student', 403)
    const event = await eventRecord(actor, id, tx, true)
    if (event.registrationMode === 'public') return fail('Use the event invitation and public registration form for this event', 409)
    const { bookings, ledger } = await records(id, tx)
    const prior = bookings.find(booking => booking.requestKey === body.requestKey)
    if (prior) { if (!ownsBooking(actor, prior)) return fail('Booking not found', 404); return prior }
    if (!visible(actor, event) || (review ? !['open', 'closed'].includes(event.status) : event.status !== 'open' || today() > event.registrationDeadline)) return fail('Registration is closed')
    const student = await tx.query.students.findFirst({ where: and(eq(tables.students.id, body.studentId), eq(tables.students.organizationId, actor.organizationId)) })
    if (!student || student.status !== 'active' || (!actor.portal && actor.dojoIds !== null && (!student.dojoId || !actor.dojoIds.includes(student.dojoId))) || (event.dojoIds.length && (!student.dojoId || !event.dojoIds.includes(student.dojoId)))) return fail('Student is not eligible or outside your access', 403)
    if (body.discount && !canManageEvent(actor, event)) return fail('Only event managers can discount bookings', 403)
    if (bookings.some(booking => booking.studentId === student.id && booking.status !== 'cancelled')) return fail('This student already has an active booking', 409)
    const attendees = normalizeAttendees(body.attendees, student, [], actor.portal)
    if (!registrationForm && attendees.some(person => person.underFive)) return fail('The under-five concession is not available on this event')
    if (!event.transportProvided && attendees.some(attendeeRequestsTransport)) return fail('Transport is not provided for this event')
    const prices = priceSnapshot || event.prices
    if (body.discount > eventCharge(attendees, prices).subtotal) return fail('Discount cannot exceed the booking price')
    const values = { eventId: id, studentId: student.id, dojoId: student.dojoId, reference: `EV-${randomUUID().slice(0, 8).toUpperCase()}`, requestKey: body.requestKey, attendees, prices, registrationForm, contactName: body.contactName, contactPhone: body.contactPhone, emergencyName: body.emergencyName, emergencyPhone: body.emergencyPhone, discount: body.discount, notes: body.notes, consent: { ...body.consent, terms: termsSnapshot ?? event.terms, acceptedAt: body.consent.accepted ? new Date().toISOString() : null }, customAnswers, status: 'provisional' }
    const problem = capacityProblem(eventOccupancy([...bookings, values]), event)
    if (problem && !body.waitlist) return fail(`${problem}. Choose the waiting list to submit without reserving space.`, 409)
    if (body.waitlist) values.status = 'waitlisted'
    const [booking] = await tx.insert(tables.eventBookings).values(values).returning()
    const status = automaticStatus(event, booking!, ledger)
    const [saved] = await tx.update(tables.eventBookings).set({ status }).where(eq(tables.eventBookings.id, booking!.id)).returning()
    if (body.saveGuardians) await saveGuardians(tx, saved!)
    await audit(tx, actor, id, 'booking.created', `${saved!.reference}: ${attendees.length} attendees; ${status}`, saved!.id)
    return saved
}
export async function createEventBooking(actor: Actor, id: number, input: unknown) {
  const body = validate(bookingSchema, input)
  return db.transaction(tx => createEventBookingInTx(tx, actor, id, body))
}

export async function setPublicEventRegistration(actor: Actor, id: number, action: unknown) {
  const parsed = validate(z.object({ action: z.enum(['enable', 'disable', 'rotate']) }), action)
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can manage public registration', 403)
    if (parsed.action === 'enable' && event.status !== 'open') return fail('Open the event before enabling its public form')
    const publicRegistrationToken = parsed.action === 'rotate' || !event.publicRegistrationToken ? randomBytes(32).toString('hex') : event.publicRegistrationToken
    const publicRegistrationEnabled = parsed.action !== 'disable' && (parsed.action !== 'rotate' || event.publicRegistrationEnabled)
    const [saved] = await tx.update(tables.campEvents).set({ publicRegistrationToken, publicRegistrationEnabled, updatedAt: new Date() }).where(eq(tables.campEvents.id, id)).returning()
    await audit(tx, actor, id, 'registration.link', `${parsed.action} public registration link`)
    return { enabled: saved!.publicRegistrationEnabled, token: saved!.publicRegistrationToken }
  })
}

async function createGuestBookingInTx(tx: Tx, actor: Actor, event: Camp, request: typeof tables.eventRegistrationRequests.$inferSelect, waitlist: boolean) {
  const { bookings, ledger } = await records(event.id, tx)
  if (bookings.some(booking => booking.requestKey === request.requestKey)) return fail('This request already has a booking', 409)
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
  if (request.attendees.some(candidate => candidate.type === 'student' && bookings.some(booking => booking.status !== 'cancelled' && booking.attendees.some(person => person.type === 'student' && normalize(person.name) === normalize(candidate.name) && (person.dateOfBirth || booking.guestProfile?.dateOfBirth) === (candidate.dateOfBirth || request.dateOfBirth))))) return fail('A guest booking for a student with this name and birth date already exists', 409)
  const attendees = normalizeAttendees(request.attendees.map(({ id: _id, studentId: _studentId, checkedInAt: _checkedInAt, ...person }) => person), null)
  if (!event.transportProvided && attendees.some(attendeeRequestsTransport)) return fail('Transport is not provided for this event')
  const guestProfile: EventGuestProfile = { dateOfBirth: request.dateOfBirth || '', membershipNumber: request.membershipNumber, dojoName: request.sourceDojoName || 'Independent', city: request.sourceCity, state: request.sourceState, country: request.sourceCountry, instructorName: request.instructorName, currentGrade: request.currentGrade }
  const values = { eventId: event.id, studentId: null, guestProfile, dojoId: event.registrationMode === 'public' ? null : request.dojoId, reference: `EV-${randomUUID().slice(0, 8).toUpperCase()}`, requestKey: request.requestKey, attendees, prices: request.prices, registrationForm: request.registrationForm, contactName: request.contactName, contactPhone: request.contactPhone, emergencyName: request.emergencyName, emergencyPhone: request.emergencyPhone, discount: 0, notes: request.notes, consent: request.consent, customAnswers: request.customAnswers, status: 'provisional' }
  const problem = capacityProblem(eventOccupancy([...bookings, values]), event)
  if (problem && !waitlist) return fail(`${problem}. Select waiting list to approve without reserving a place.`, 409)
  if (waitlist) values.status = 'waitlisted'
  const [booking] = await tx.insert(tables.eventBookings).values(values).returning()
  const status = automaticStatus(event, booking!, ledger)
  const [saved] = await tx.update(tables.eventBookings).set({ status }).where(eq(tables.eventBookings.id, booking!.id)).returning()
  await audit(tx, actor, event.id, 'booking.created', `${saved!.reference}: guest from ${guestProfile.dojoName}, ${guestProfile.state}; ${status}`, saved!.id)
  return saved!
}

export async function reviewEventRegistration(actor: Actor, id: number, requestId: number, input: unknown) {
  const body = validate(z.object({ action: z.enum(['approve', 'reject']), mode: z.enum(['existing', 'guest']).optional(), studentId: z.number().int().positive().optional(), waitlist: z.boolean().default(false) }), input)
  if (!Number.isSafeInteger(requestId) || requestId <= 0) return fail('Invalid registration request')
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can review registration requests', 403)
    const [request] = await tx.select().from(tables.eventRegistrationRequests).where(and(eq(tables.eventRegistrationRequests.id, requestId), eq(tables.eventRegistrationRequests.eventId, id))).for('update')
    if (!request) return fail('Registration request not found', 404)
    if (event.registrationMode === 'public' && (body.mode === 'existing' || body.studentId)) return fail('Public event participants cannot be linked to dojo student records', 409)
    if (request.status !== 'submitted') return fail('This registration request has already been reviewed', 409)
    if (body.action === 'reject') {
      const [saved] = await tx.update(tables.eventRegistrationRequests).set({ status: 'rejected', reviewedBy: actor.userId, reviewedAt: new Date() }).where(eq(tables.eventRegistrationRequests.id, request.id)).returning()
      await audit(tx, actor, id, 'registration.rejected', request.reference)
      return saved
    }
    if (request.physicalCopyRequired && !request.physicalCopyReceivedAt) return fail('Record the signed physical copy before approving this request', 409)
    if (!['open', 'closed'].includes(event.status)) return fail('Reopen the event before approving registrations')
    let booking: Booking
    if ((body.mode || (event.registrationMode === 'public' ? 'guest' : 'existing')) === 'guest') {
      booking = await createGuestBookingInTx(tx, actor, event, request, body.waitlist || request.waitlist)
    } else {
      if (!body.studentId) return fail('Choose the matching student before approving')
      const student = await tx.query.students.findFirst({ where: and(eq(tables.students.id, body.studentId), eq(tables.students.organizationId, actor.organizationId)) })
      if (!student || student.status !== 'active' || (request.dojoId && student.dojoId !== request.dojoId)) return fail('Choose an active student from the submitted dojo')
      const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
      if (normalized(`${student.firstName} ${student.lastName}`) !== normalized(request.studentName)) return fail('Student name does not match the registration request')
      if (student.dateOfBirth && request.dateOfBirth && student.dateOfBirth.toISOString().slice(0, 10) !== request.dateOfBirth) return fail('Student date of birth does not match the registration request')
      if (student.membershipNumber && request.membershipNumber && student.membershipNumber.trim().toLowerCase() !== request.membershipNumber.trim().toLowerCase()) return fail('Student membership number does not match the registration request')
      booking = (await createEventBookingInTx(tx, actor, id, {
        studentId: student.id, requestKey: request.requestKey,
        attendees: request.attendees.map(({ id: _id, studentId: _studentId, checkedInAt: _checkedInAt, ...person }) => ({ ...person, underFive: person.underFive ?? false, dateOfBirth: person.dateOfBirth ?? '', currentGrade: person.currentGrade ?? '', membershipNumber: person.membershipNumber ?? '' })), contactName: request.contactName, contactPhone: request.contactPhone,
        emergencyName: request.emergencyName, emergencyPhone: request.emergencyPhone,
        consent: request.consent, discount: 0, notes: request.notes, saveGuardians: false, waitlist: body.waitlist || request.waitlist,
      }, request.prices, true, request.consent.terms, request.customAnswers, request.registrationForm))!
    }
    const [saved] = await tx.update(tables.eventRegistrationRequests).set({ status: 'approved', bookingId: booking!.id, reviewedBy: actor.userId, reviewedAt: new Date() }).where(eq(tables.eventRegistrationRequests.id, request.id)).returning()
    await audit(tx, actor, id, 'registration.approved', `${request.reference} → ${booking!.reference}`, booking!.id)
    return saved
  })
}

export async function markEventPhysicalCopy(actor: Actor, id: number, requestId: number) {
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can receive signed forms', 403)
    const [request] = await tx.select().from(tables.eventRegistrationRequests).where(and(eq(tables.eventRegistrationRequests.id, requestId), eq(tables.eventRegistrationRequests.eventId, id))).for('update')
    if (!request) return fail('Registration request not found', 404)
    if (request.status === 'rejected') return fail('A rejected request cannot receive a signed form', 409)
    if (request.physicalCopyReceivedAt) return request
    const [saved] = await tx.update(tables.eventRegistrationRequests).set({ physicalCopyReceivedAt: new Date(), physicalCopyReceivedBy: actor.userId }).where(eq(tables.eventRegistrationRequests.id, requestId)).returning()
    await audit(tx, actor, id, 'registration.physical_copy_received', request.reference, request.bookingId || undefined)
    return saved
  })
}

export async function correctEventRegistration(actor: Actor, id: number, requestId: number, input: unknown) {
  const changes = validate(eventRequestCorrectionSchema, input)
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can correct requests', 403)
    const [request] = await tx.select().from(tables.eventRegistrationRequests).where(and(eq(tables.eventRegistrationRequests.id, requestId), eq(tables.eventRegistrationRequests.eventId, id))).for('update')
    if (!request) return fail('Registration request not found', 404)
    if (request.status !== 'submitted') return fail('Only pending requests can be corrected', 409)
    if (request.sourceType !== 'external' && ['sourceDojoName', 'sourceCity', 'sourceState', 'sourceCountry', 'instructorName'].some(key => key in changes)) return fail('The source dojo is linked to the existing organization location')
    if (event.registrationMode === 'public' && (!((changes.sourceCity ?? request.sourceCity).trim()) || !((changes.sourceState ?? request.sourceState).trim()) || !((changes.instructorName ?? request.instructorName).trim()))) return fail('Enter city, state and instructor name')
    if (request.registrationForm && !(changes.currentGrade ?? request.currentGrade).trim()) return fail('Enter the student current grade or belt')
  const attendees = request.attendees.map((person, index) => index === 0 && person.type === 'student' ? { ...person, name: changes.studentName ?? person.name, dateOfBirth: changes.dateOfBirth ?? person.dateOfBirth, membershipNumber: changes.membershipNumber ?? person.membershipNumber, currentGrade: changes.currentGrade ?? person.currentGrade } : person)
    const [saved] = await tx.update(tables.eventRegistrationRequests).set({ ...changes, attendees }).where(eq(tables.eventRegistrationRequests.id, requestId)).returning()
    await audit(tx, actor, id, 'registration.corrected', `${request.reference}: ${Object.keys(changes).join(', ')}`)
    return saved
  })
}

export async function updateEventBooking(actor: Actor, id: number, bookingId: number, input: unknown) {
  const body = validate(bookingUpdateSchema, input)
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    const { bookings, ledger } = await records(id, tx)
    const previous = bookings.find(booking => booking.id === bookingId)
    const manager = canManageEvent(actor, event)
    if (!previous || (!manager && !ownsBooking(actor, previous))) return fail('Booking not found', 404)
    if (previous.version !== body.version) return fail('This booking changed. Refresh it before saving.', 409)
    if (previous.status === 'cancelled') return fail('Cancelled bookings remain in history. Create a new booking instead.')
    if (['completed', 'cancelled'].includes(event.status)) return fail('Reopen the event before changing registrations')
    if (actor.portal && (event.status !== 'open' || today() > (event.detailsDeadline || event.registrationDeadline))) return fail('Please contact your instructor to change this booking after the details deadline')
    if (!manager && (body.status !== undefined || body.discount !== undefined || body.cancellationFee !== undefined)) return fail('Only event managers can change booking status or charges', 403)
    if (body.guestProfile && (!manager || previous.studentId !== null)) return fail('Only an event manager can correct a guest source', 403)
    if (body.guestProfile && event.registrationMode === 'public' && (!body.guestProfile.city?.trim() || !body.guestProfile.state.trim() || !body.guestProfile.instructorName?.trim())) return fail('Enter city, state and instructor name')
    if (body.guestProfile && previous.registrationForm && !body.guestProfile.currentGrade?.trim()) return fail('Enter the student current grade or belt')
    if (actor.portal && body.checkInId) return fail('Check-in is managed by staff', 403)
    const student = previous.studentId ? await tx.query.students.findFirst({ where: eq(tables.students.id, previous.studentId) }) : null
    if (previous.studentId && !student) return fail('Student not found', 404)
    const attendees = body.attendees ? normalizeAttendees(body.attendees, student || null, previous.attendees, actor.portal) : previous.attendees
    if (event.registrationMode === 'public' && body.attendees) {
      const originalStudents = previous.attendees.filter(person => person.type === 'student').map(person => person.id)
      const editedStudents = attendees.filter(person => person.type === 'student').map(person => person.id)
      if (originalStudents.length !== editedStudents.length || originalStudents.some((id, index) => id !== editedStudents[index])) return fail('Students in an approved public booking cannot be added or removed')
    }
    if (!previous.registrationForm && attendees.some(person => person.underFive)) return fail('The under-five concession is not available on this booking')
    if (previous.registrationForm && (attendees.length !== previous.attendees.length || attendees.some(person => {
      const original = previous.attendees.find(old => old.id === person.id)
      return !original || person.underFive !== original.underFive || person.dateOfBirth !== original.dateOfBirth || person.accommodation !== original.accommodation || person.transportOut !== original.transportOut || person.transportReturn !== original.transportReturn
    }))) return fail('This fee package has fixed attendees and inclusions; changes that affect the agreed fee are not allowed')
    if (!event.transportProvided && attendees.some(attendeeRequestsTransport)) return fail('Transport is not provided for this event')
    if (body.checkInId) {
      if (previous.status !== 'confirmed') return fail('Confirm the booking before check-in')
      const person = attendees.find(person => person.id === body.checkInId)
      if (!person) return fail('Attendee not found', 404)
      person.checkedInAt = body.checkIn ? new Date().toISOString() : null
    }
    const next = { ...previous, attendees, guestProfile: body.guestProfile ?? previous.guestProfile, contactName: body.contactName ?? previous.contactName, contactPhone: body.contactPhone ?? previous.contactPhone, emergencyName: body.emergencyName ?? previous.emergencyName, emergencyPhone: body.emergencyPhone ?? previous.emergencyPhone, discount: body.discount ?? previous.discount, cancellationFee: body.cancellationFee ?? previous.cancellationFee, notes: body.notes ?? previous.notes, status: body.status ?? previous.status,
      consent: body.consent ? { ...body.consent, terms: previous.consent.terms || event.terms, acceptedAt: body.consent.accepted ? new Date().toISOString() : null } : previous.consent }
    const charge = eventCharge(attendees, next.prices, next.discount)
    if (next.discount > charge.subtotal || next.cancellationFee > charge.net) return fail('Discount or retained cancellation fee exceeds the booking price')
    if (next.status === 'confirmed' && bookingMissingDetails(next).length) return fail('Complete attendee names, relationships, contact and consent before confirmation')
    if (next.status === 'waitlisted' && bookingBalance(previous, ledger).paid > 0) return fail('Refund the booking before moving it to the waiting list')
    if (reservingStatuses.includes(next.status as 'pending')) {
      const problem = capacityProblem(eventOccupancy(bookings.map(booking => booking.id === bookingId ? next : booking)), event)
      if (problem) return fail(problem, 409)
    }
    if (!body.status) next.status = automaticStatus(event, next, ledger)
    // Confirmation policy also applies to explicit staff confirmations.
    if (next.status === 'confirmed' && event.confirmationRule !== 'staff' && automaticStatus(event, next, ledger) !== 'confirmed') return fail('The required deposit or full payment is still outstanding')
    const { id: _id, createdAt: _created, ...values } = next
    const [saved] = await tx.update(tables.eventBookings).set({ ...values, version: previous.version + 1, updatedAt: new Date() }).where(eq(tables.eventBookings.id, bookingId)).returning()
    if (body.saveGuardians) await saveGuardians(tx, saved!)
    await audit(tx, actor, id, 'booking.updated', `${previous.reference}: ${previous.status} → ${saved!.status}; total ${bookingBalance(saved!, ledger).total}; consent ${saved!.consent.accepted ? 'accepted' : 'pending'}`, bookingId)
    return saved
  })
}

export async function addEventCost(actor: Actor, id: number, input: unknown) {
  const body = validate(costSchema, input)
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can record costs', 403)
    const [prior] = await tx.select().from(tables.eventCosts).where(and(eq(tables.eventCosts.eventId, id), eq(tables.eventCosts.requestKey, body.requestKey)))
    if (prior) return prior
    if (event.status === 'completed' && body.status !== 'incurred') return fail('Completed events accept incurred costs only. Reopen the event to add commitments.')
    const [saved] = await tx.insert(tables.eventCosts).values({ ...body, eventId: id }).returning()
    await audit(tx, actor, id, 'cost.created', `${body.supplier}: ${body.description}; ${body.amount + body.tax}`)
    return saved
  })
}

export async function updateEventCost(actor: Actor, id: number, costId: number, input: unknown) {
  const changes = validate(costUpdateSchema, typeof input === 'string' ? { status: input } : input)
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can change costs', 403)
    const { costs, ledger } = await records(id, tx)
    const cost = costs.find(row => row.id === costId)
    if (!cost || cost.status === 'cancelled') return fail('Cost is unavailable')
    const paid = ledger.filter(row => row.costId === costId).reduce((sum, row) => sum + (row.kind === 'cost_payment' ? row.amount : -row.amount), 0)
    if (changes.status === 'cancelled' && paid > 0) return fail('Record the supplier refund before cancelling a paid cost')
    if (event.status === 'completed' && ['amount', 'tax', 'category', 'status'].some(field => field in changes)) return fail('Reopen the event to change financial costs')
    if (paid > 0 && ['amount', 'tax', 'category'].some(field => field in changes)) return fail('Refund supplier payments before changing the cost amount or category')
    const [saved] = await tx.update(tables.eventCosts).set(changes).where(eq(tables.eventCosts.id, costId)).returning()
    await audit(tx, actor, id, 'cost.updated', `Cost ${costId}: ${JSON.stringify(changes)}`)
    return saved
  })
}

export async function addEventTransaction(actor: Actor, id: number, input: unknown) {
  const body = validate(ledgerSchema, input)
  return db.transaction(async tx => {
    const event = await eventRecord(actor, id, tx, true)
    if (!canManageEvent(actor, event)) return fail('Only event managers can record financial transactions', 403)
    const { bookings, ledger, costs } = await records(id, tx)
    const prior = ledger.find(row => row.requestKey === body.requestKey)
    if (prior) return prior
    if (body.tax > body.amount || (!['income', 'income_refund'].includes(body.kind) && body.tax)) return fail('Tax must be included in income and cannot exceed the total')
    if (body.occurredOn > today()) return fail('A received payment cannot have a future date')
    const isBooking = ['payment', 'refund'].includes(body.kind)
    const isCost = ['cost_payment', 'cost_refund'].includes(body.kind)
    const booking = bookings.find(row => row.id === body.bookingId)
    const cost = costs.find(row => row.id === body.costId)
    if ((isBooking && (!booking || body.costId)) || (isCost && (!cost || body.bookingId)) || (!isBooking && !isCost && (body.bookingId || body.costId))) return fail('Select a valid booking or supplier cost for this event')
    const reversalKind: Record<string, string> = { refund: 'payment', income_refund: 'income', cost_refund: 'cost_payment' }
    if (reversalKind[body.kind]) {
      const source = ledger.find(row => row.id === body.sourceId && row.kind === reversalKind[body.kind] && row.bookingId === body.bookingId && row.costId === body.costId)
      if (!source) return fail('Select the original payment to refund')
      const refunded = ledger.filter(row => row.sourceId === source.id).reduce((sum, row) => sum + row.amount, 0)
      if (body.amount > source.amount - refunded) return fail('Refund exceeds the remaining original payment')
      if (body.occurredOn < source.occurredOn) return fail('A refund cannot predate its original payment')
      if (body.kind === 'income_refund') {
        const taxRefunded = ledger.filter(row => row.sourceId === source.id).reduce((sum, row) => sum + row.tax, 0)
        body.tax = body.amount === source.amount - refunded ? source.tax - taxRefunded : Math.min(source.tax - taxRefunded, Math.round(body.amount * source.tax / source.amount))
      }
    } else if (body.sourceId) return fail('Only refunds can reference an earlier transaction')
    if (body.kind === 'payment' && (booking!.status === 'waitlisted' || body.amount > bookingBalance(booking!, ledger).outstanding)) return fail('Payment exceeds the balance due or the booking is waitlisted')
    if (body.kind === 'cost_payment') {
      const paid = ledger.filter(row => row.costId === body.costId).reduce((sum, row) => sum + (row.kind === 'cost_payment' ? row.amount : -row.amount), 0)
      if (cost!.status === 'cancelled' || body.amount > cost!.amount + cost!.tax - paid) return fail('Payment exceeds the supplier balance')
    }
    const [saved] = await tx.insert(tables.eventLedger).values({ ...body, eventId: id, createdBy: actor.userId, receiptNumber: `EVT-${randomUUID().slice(0, 12).toUpperCase()}` }).returning()
    if (booking) await tx.update(tables.eventBookings).set({ status: automaticStatus(event, booking, [...ledger, saved!]), version: booking.version + 1, updatedAt: new Date() }).where(eq(tables.eventBookings.id, booking.id))
    await audit(tx, actor, id, `finance.${body.kind}`, `${saved!.receiptNumber}: ${body.amount}; ${body.description}`, booking?.id)
    return saved
  })
}
