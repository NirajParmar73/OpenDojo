// Run with: bun run tests/events.integration.ts
// Uses a uniquely named disposable database on the configured LOCAL Postgres server.
// It never migrates, seeds or deletes records in the configured application database.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { eq } from 'drizzle-orm'
import { defaultEventFormSettings } from '../shared/types/events'
import sharp from 'sharp'

const applicationUrl = new URL(process.env.DATABASE_URL || '')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(applicationUrl.hostname), 'Integration tests require a local PostgreSQL server')
const testName = `opendojo_events_test_${randomUUID().replaceAll('-', '')}`
assert.match(testName, /^opendojo_events_test_[a-f0-9]{32}$/)
const admin = postgres(applicationUrl.toString(), { max: 1, onnotice: () => {} })
let created = false
let connection: ReturnType<typeof postgres> | undefined
try {
  await admin.unsafe(`CREATE DATABASE "${testName}"`)
  created = true
  const testUrl = new URL(applicationUrl)
  testUrl.pathname = `/${testName}`
  process.env.DATABASE_URL = testUrl.toString()
  connection = postgres(testUrl.toString(), { max: 1, onnotice: () => {} })
  await migrate(drizzle(connection), { migrationsFolder: 'server/database/drizzle-postgres' })
  console.log('PASS: all migrations apply to a clean PostgreSQL database')
  // Nuxt supplies this helper at runtime; the service tests supply the same error shape.
  Object.assign(globalThis, { createError: (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input) })
  const { db, tables } = await import('../server/utils/database')
  const service = await import('../server/utils/events')
  const [org] = await db.insert(tables.organizations).values({ name: 'Event test', slug: 'event-test', currency: 'INR' }).returning()
  const [otherOrg] = await db.insert(tables.organizations).values({ name: 'Other tenant', slug: 'other-event-test', currency: 'INR' }).returning()
  const [owner] = await db.insert(tables.users).values({ name: 'Owner', email: 'owner@example.test', passwordHash: 'test-only', organizationId: org!.id, role: 'owner' }).returning()
  const [level] = await db.insert(tables.hierarchyLevels).values({ organizationId: org!.id, name: 'Region', order: 1 }).returning()
  const [node] = await db.insert(tables.hierarchyNodes).values({ organizationId: org!.id, levelId: level!.id, name: 'Region' }).returning()
  const [dojo] = await db.insert(tables.dojos).values({ organizationId: org!.id, nodeId: node!.id, name: 'Test dojo' }).returning()
  const students = await db.insert(tables.students).values(['One', 'Two', 'Three', 'Four'].map(name => ({ organizationId: org!.id, dojoId: dojo!.id, firstName: name, lastName: 'Student' }))).returning()
  const staff = { organizationId: org!.id, userId: owner!.id, studentId: null, student: null, dojoIds: null, portal: false, manager: true, label: 'Test owner' }
  const portal = { ...staff, userId: null, studentId: students[0]!.id, student: students[0]!, dojoIds: [dojo!.id], portal: true, manager: false, label: 'Test student' }
  const otherStudent = { ...portal, studentId: students[1]!.id, student: students[1]! }
  const body = { name: 'Residential camp', startDate: '2099-12-26', endDate: '2099-12-30', registrationDeadline: '2099-12-01', terms: 'Participation and cancellation terms', status: 'open', registrationMode: 'linked', capacity: 3, bedCapacity: 3, prices: { student: 1700000, parent: 1200000, transportOut: 50000, transportReturn: 50000, accommodation: 0, taxBps: 0 }, confirmationRule: 'deposit', deposit: 100000, fixedBudget: 500000, perPersonBudget: 200000, overheadBudget: 100000, formSettings: { ...defaultEventFormSettings, requirePhoto: false, requirePhysicalCopy: false } }
  await assert.rejects(service.saveEvent(staff, body), /organization-wide public registration/)
  const createLegacyEvent = async (input: Record<string, unknown>) => { const saved = await service.saveEvent(staff, { ...input, registrationMode: 'public' }); await db.update(tables.campEvents).set({ registrationMode: 'linked' }).where(eq(tables.campEvents.id, saved!.id)); return { ...saved!, registrationMode: 'linked' } }
  const event = await createLegacyEvent(body)
  const publicService = await import('../server/utils/public-event-registration')
  const publicEvent = await createLegacyEvent({ ...body, name: 'Shared link camp' })
  await db.update(tables.students).set({ dateOfBirth: new Date('2012-05-06T00:00:00.000Z'), membershipNumber: 'KGI-004' }).where(eq(tables.students.id, students[3]!.id))
  const link = await service.setPublicEventRegistration(staff, publicEvent!.id, { action: 'enable' })
  assert.equal(link.enabled, true)
  const publicHttp = { context: {} } as any
  const form = await publicService.publicRegistrationForm(publicHttp, link.token!)
  assert.equal(form.event.name, 'Shared link camp')
  const publicInput = { requestKey: randomUUID(), dojoId: dojo!.id, dateOfBirth: '2012-05-06', membershipNumber: 'KGI-004', attendees: [{ type: 'student', name: 'Four Student', meal: 'Vegetarian' }, { type: 'parent', name: '', relationship: '' }], contactName: 'Family', contactPhone: '9000000000', consent: { name: 'Family', phone: '9000000000', accepted: true } }
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, link.token!, { ...publicInput, consent: { ...publicInput.consent, accepted: false } }), /accepted/)
  const submitted = await publicService.submitPublicEventRegistration(publicHttp, link.token!, publicInput)
  assert.match(submitted.reference, /^EVR-/)
  assert.equal(submitted.physicalCopyInstructions, '')
  assert.equal((await publicService.submitPublicEventRegistration(publicHttp, link.token!, publicInput)).reference, submitted.reference)
  let publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  assert.equal(publicDetail.occupancy.people, 0)
  assert.equal(publicDetail.registrationRequests.length, 1)
  assert.equal((await service.getEventDetail(portal, publicEvent!.id)).registrationRequests.length, 0)
  const request = publicDetail.registrationRequests[0]!
  await assert.rejects(service.reviewEventRegistration(portal, publicEvent!.id, request.id, { action: 'approve', studentId: students[3]!.id }), /Only event managers/)
  await assert.rejects(service.reviewEventRegistration(staff, publicEvent!.id, request.id, { action: 'approve', studentId: students[2]!.id }), /name does not match/)
  await service.saveEvent(staff, { ...body, name: 'Shared link camp', prices: { ...body.prices, student: 2200000 } }, publicEvent!.id)
  await service.reviewEventRegistration(staff, publicEvent!.id, request.id, { action: 'approve', studentId: students[3]!.id })
  publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  assert.equal(publicDetail.registrationRequests[0]!.status, 'approved')
  assert.equal(publicDetail.bookings[0]!.status, 'provisional')
  assert.equal(publicDetail.bookings[0]!.balance.total, 2900000)
  assert.equal(publicDetail.occupancy.people, 2)
  await db.insert(tables.eventInvitations).values({ eventId: publicEvent!.id, filename: 'Invitation.pdf', dataBase64: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') })
  assert.equal((await publicService.publicRegistrationForm(publicHttp, link.token!)).event.invitationFilename, 'Invitation.pdf')
  const guestInput = { requestKey: randomUUID(), sourceType: 'external', dojoId: null, sourceDojoName: 'Outside Academy', sourceState: 'Gujarat', sourceCountry: 'India', dateOfBirth: '2010-04-05', attendees: [{ type: 'student', name: 'Outside Student', meal: 'Vegetarian' }], contactName: 'Outside Parent', contactPhone: '9000000001', consent: { name: 'Outside Parent', phone: '9000000001', accepted: true } }
  await publicService.submitPublicEventRegistration(publicHttp, link.token!, guestInput)
  publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  const guestRequest = publicDetail.registrationRequests.find(row => row.studentName === 'Outside Student')!
  assert.equal(guestRequest.attendees[0]!.meal, '')
  await service.reviewEventRegistration(staff, publicEvent!.id, guestRequest.id, { action: 'approve', mode: 'guest' })
  publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  const guestBooking = publicDetail.bookings.find(row => row.guestProfile?.dojoName === 'Outside Academy')!
  assert.equal(guestBooking.studentId, null)
  assert.equal(guestBooking.guestProfile!.state, 'Gujarat')
  assert.equal(guestBooking.balance.total, 2200000)
  assert.equal(publicDetail.registrationSummary!.guestStudents, 1)
  assert.equal((await db.select().from(tables.students)).length, students.length)
  await service.addEventTransaction(staff, publicEvent!.id, { requestKey: randomUUID(), kind: 'payment', bookingId: guestBooking.id, amount: 100000, method: 'upi', occurredOn: '2026-10-01', description: 'Guest deposit' })
  publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  assert.equal(publicDetail.bookings.find(row => row.id === guestBooking.id)!.paymentStatus, 'part_paid')
  assert.equal(publicDetail.bookings.find(row => row.id === guestBooking.id)!.status, 'confirmed')
  await publicService.submitPublicEventRegistration(publicHttp, link.token!, { ...guestInput, requestKey: randomUUID(), attendees: [{ type: 'student', name: 'Second Guest', meal: 'Vegetarian' }] })
  publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  const overflowRequest = publicDetail.registrationRequests.find(row => row.studentName === 'Second Guest')!
  await assert.rejects(service.reviewEventRegistration(staff, publicEvent!.id, overflowRequest.id, { action: 'approve', mode: 'guest' }), /capacity is full/)
  await service.reviewEventRegistration(staff, publicEvent!.id, overflowRequest.id, { action: 'approve', mode: 'guest', waitlist: true })
  publicDetail = await service.getEventDetail(staff, publicEvent!.id)
  assert.equal(publicDetail.registrationSummary!.waitlistedStudents, 1)
  assert.equal(publicDetail.occupancy.people, 3)
  console.log('PASS: outside guest enrollment, invitation, ledger payment, capacity and waiting list')
  const rotated = await service.setPublicEventRegistration(staff, publicEvent!.id, { action: 'rotate' })
  await assert.rejects(publicService.publicRegistrationForm(publicHttp, link.token!), /unavailable/)
  await service.setPublicEventRegistration(staff, publicEvent!.id, { action: 'disable' })
  await assert.rejects(publicService.publicRegistrationForm(publicHttp, rotated.token!), /unavailable/)
  console.log('PASS: public link, provisional intake, private review, matching, idempotency and revocation')
  const genericEvent = await service.saveEvent(staff, { ...body, name: 'Open community camp', registrationMode: 'public', transportProvided: false })
  assert.equal(genericEvent!.registrationMode, 'public')
  assert.equal(genericEvent!.transportProvided, false)
  assert.equal(genericEvent!.prices.transportOut, 0)
  assert.equal(genericEvent!.prices.transportReturn, 0)
  const genericLink = await service.setPublicEventRegistration(staff, genericEvent!.id, { action: 'enable' })
  const genericForm = await publicService.publicRegistrationForm(publicHttp, genericLink.token!)
  assert.equal(genericForm.event.registrationMode, 'public')
  assert.equal(genericForm.event.transportProvided, false)
  assert.deepEqual(genericForm.dojos, [])
  const genericInput = { requestKey: randomUUID(), sourceCity: 'Pune', sourceState: 'Maharashtra', instructorName: 'Coach Rao', dateOfBirth: '2011-03-04', attendees: [{ type: 'student', name: 'Independent Student' }], contactName: 'Independent Parent', contactPhone: '9000000044', consent: { name: 'Independent Parent', phone: '9000000044', accepted: true } }
  for (const field of ['sourceCity', 'sourceState', 'instructorName'] as const) {
    await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, genericLink.token!, { ...genericInput, [field]: '   ' }), /Enter city, state and instructor name/)
  }
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, genericLink.token!, { ...genericInput, sourceType: 'internal', dojoId: dojo!.id }), /cannot link to a dojo/)
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, genericLink.token!, { ...genericInput, attendees: [{ type: 'student', name: 'Independent Student', transportOut: true }] }), /Transport is not provided/)
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, genericLink.token!, { ...genericInput, attendees: [{ type: 'student', name: 'Independent Student', busOut: 'Pickup point' }] }), /Transport is not provided/)
  await publicService.submitPublicEventRegistration(publicHttp, genericLink.token!, genericInput)
  const genericRequest = (await service.getEventDetail(staff, genericEvent!.id)).registrationRequests[0]!
  assert.equal(genericRequest.dojoId, null)
  assert.equal(genericRequest.sourceDojoName, '')
  assert.equal(genericRequest.sourceCity, 'Pune')
  assert.equal(genericRequest.sourceState, 'Maharashtra')
  assert.equal(genericRequest.instructorName, 'Coach Rao')
  await assert.rejects(service.reviewEventRegistration(staff, genericEvent!.id, genericRequest.id, { action: 'approve', mode: 'existing', studentId: students[0]!.id }), /cannot be linked/)
  await assert.rejects(service.createEventBooking(staff, genericEvent!.id, { requestKey: randomUUID(), studentId: students[0]!.id, attendees: [{ type: 'student', name: 'One Student' }], contactName: 'Parent', contactPhone: '9000000000', consent: { name: 'Parent', phone: '9000000000', accepted: true } }), /public registration form/)
  await service.reviewEventRegistration(staff, genericEvent!.id, genericRequest.id, { action: 'approve' })
  const genericDetail = await service.getEventDetail(staff, genericEvent!.id)
  assert.equal(genericDetail.bookings[0]!.studentId, null)
  assert.equal(genericDetail.bookings[0]!.dojoId, null)
  assert.equal(genericDetail.bookings[0]!.guestProfile?.city, 'Pune')
  assert.equal(genericDetail.bookings[0]!.guestProfile?.instructorName, 'Coach Rao')
  await assert.rejects(service.updateEventBooking(staff, genericEvent!.id, genericDetail.bookings[0]!.id, { version: genericDetail.bookings[0]!.version, attendees: genericDetail.bookings[0]!.attendees.map(person => ({ ...person, transportReturn: true })) }), /Transport is not provided/)
  await assert.rejects(service.updateEventBooking(staff, genericEvent!.id, genericDetail.bookings[0]!.id, { version: genericDetail.bookings[0]!.version, guestProfile: { ...genericDetail.bookings[0]!.guestProfile!, city: '   ' } }), /Enter city, state and instructor name/)
  assert.equal(genericDetail.students.length, 0)
  assert.ok(genericDetail.finances!.bookingRevenue > 0)
  await service.addEventTransaction(staff, genericEvent!.id, { requestKey: randomUUID(), kind: 'payment', bookingId: genericDetail.bookings[0]!.id, amount: 100000, method: 'upi', occurredOn: '2026-10-01', description: 'Public event fee' })
  assert.equal((await service.getEventDetail(staff, genericEvent!.id)).finances!.collected, 100000)
  assert.equal((await db.select().from(tables.payments)).length, 0)
  assert.equal((await db.select().from(tables.students)).length, students.length)
  await assert.rejects(service.getEventDetail(portal, genericEvent!.id), /Event not found/)
  assert.equal((await service.listEvents({ ...staff, dojoIds: [dojo!.id] })).events.some(row => row.id === genericEvent!.id), false)
  console.log('PASS: generic organization event admits independent participants without dojo or student links')
  const generalGroup = { ...genericInput, requestKey: randomUUID(), attendees: [{ type: 'student', name: 'General Group Student', meal: 'Vegetarian' }, ...Array.from({ length: 10 }, (_, index) => ({ type: 'parent', name: `General Guest ${index + 1}`, relationship: 'Guest', meal: 'Vegetarian' }))] }
  const generalGroupSubmission = await publicService.submitPublicEventRegistration(publicHttp, genericLink.token!, generalGroup)
  assert.equal(generalGroupSubmission.quote, genericEvent!.prices.student + 10 * genericEvent!.prices.parent)
  const generalGroupRequest = (await service.getEventDetail(staff, genericEvent!.id)).registrationRequests.find(row => row.reference === generalGroupSubmission.reference)!
  await service.reviewEventRegistration(staff, genericEvent!.id, generalGroupRequest.id, { action: 'approve', waitlist: true })
  assert.equal((await service.getEventDetail(staff, genericEvent!.id)).bookings.find(row => row.registrationForm === null && row.attendees.length === 11)!.attendees.length, 11)
  const busEvent = await service.saveEvent(staff, { ...body, name: 'Bus camp', registrationMode: 'public', transportProvided: true })
  const busLink = await service.setPublicEventRegistration(staff, busEvent!.id, { action: 'enable' })
  await publicService.submitPublicEventRegistration(publicHttp, busLink.token!, { ...genericInput, requestKey: randomUUID(), attendees: [{ type: 'student', name: 'Bus Student', transportOut: true }] })
  await assert.rejects(service.saveEvent(staff, { ...body, name: 'Bus camp', registrationMode: 'public', transportProvided: false }, busEvent!.id), /Review or reject transport requests/)
  const busRequest = (await service.getEventDetail(staff, busEvent!.id)).registrationRequests[0]!
  await service.reviewEventRegistration(staff, busEvent!.id, busRequest.id, { action: 'approve' })
  await assert.rejects(service.saveEvent(staff, { ...body, name: 'Bus camp', registrationMode: 'public', transportProvided: false }, busEvent!.id), /Remove or cancel existing transport bookings/)
  const busBooking = (await service.getEventDetail(staff, busEvent!.id)).bookings[0]!
  await service.updateEventBooking(staff, busEvent!.id, busBooking.id, { version: busBooking.version, status: 'cancelled' })
  const selfArrangedBusEvent = await service.saveEvent(staff, { ...body, name: 'Bus camp', registrationMode: 'public', transportProvided: false }, busEvent!.id)
  assert.equal(selfArrangedBusEvent!.prices.transportOut, 0)
  assert.equal(selfArrangedBusEvent!.outboundCapacity, 0)
  console.log('PASS: self-arranged travel hides transport charges and refuses bus requests')
  const formService = await import('../server/utils/event-registration-forms')
  const offsetDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const yearsAgo = (years: number) => { const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - years); return date.toISOString().slice(0, 10) }
  const feeEvent = await service.saveEvent(staff, { ...body, name: 'Regional fee camp', startDate: offsetDate(60), endDate: offsetDate(65), registrationDeadline: offsetDate(45), registrationMode: 'public', transportProvided: false, capacity: 0, bedCapacity: 0, confirmationRule: 'staff' })
  const baseForm = { audience: '', description: '', studentFee: 50000, companionFee: 20000, taxBps: 0, includesTraining: true, includesMeals: true, includesAccommodation: false, includesTransportOut: false, includesTransportReturn: false, enabled: true }
  const localForm = (await formService.saveRegistrationForm(staff, feeEvent!.id, { action: 'create', form: { ...baseForm, name: 'Jaipur local', audience: 'Jaipur students' } })).form!
  const awayForm = (await formService.saveRegistrationForm(staff, feeEvent!.id, { action: 'create', form: { ...baseForm, name: 'Gujarat residential', audience: 'Gujarat dojos', studentFee: 110000, includesAccommodation: true } })).form!
  assert.notEqual(localForm.token, awayForm.token)
  const awayPublicForm = await publicService.publicRegistrationForm(publicHttp, awayForm.token)
  const localPublicForm = await publicService.publicRegistrationForm(publicHttp, localForm.token)
  assert.equal(awayPublicForm.event.registrationForm?.includesAccommodation, true)
  assert.equal(localPublicForm.event.registrationForm?.includesAccommodation, false)
  const variantInput = { ...genericInput, requestKey: randomUUID(), formSignature: localPublicForm.event.formSignature!, currentGrade: 'Blue belt', sourceCity: 'Jaipur', sourceState: 'Rajasthan', attendees: [{ type: 'student', name: 'Local Student', meal: 'Vegetarian', accommodation: true }, { type: 'parent', name: 'Young Guest', relationship: 'Guest', underFive: true, dateOfBirth: yearsAgo(2), meal: 'Vegetarian', accommodation: true }] }
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, localForm.token, { ...variantInput, currentGrade: '' }), /current grade or belt/)
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, localForm.token, { ...variantInput, attendees: [{ type: 'student', name: 'Local Student' }, { type: 'parent', name: 'Young Guest', underFive: true, dateOfBirth: yearsAgo(6) }] }), /under-five concession/)
  const localSubmission = await publicService.submitPublicEventRegistration(publicHttp, localForm.token, variantInput)
  assert.equal(localSubmission.quote, 50000)
  const awaySubmission = await publicService.submitPublicEventRegistration(publicHttp, awayForm.token, { ...variantInput, formSignature: awayPublicForm.event.formSignature!, requestKey: randomUUID(), sourceCity: 'Ahmedabad', sourceState: 'Gujarat', attendees: [{ type: 'student', name: 'Away Student', meal: 'Jain' }, { type: 'parent', name: 'Adult Guest', relationship: 'Guest', meal: 'Jain' }] })
  assert.equal(awaySubmission.quote, 130000)
  let feeDetail = await service.getEventDetail(staff, feeEvent!.id)
  const localRequest = feeDetail.registrationRequests.find(row => row.studentName === 'Local Student')!
  const awayRequest = feeDetail.registrationRequests.find(row => row.studentName === 'Away Student')!
  assert.equal(localRequest.currentGrade, 'Blue belt')
  assert.equal(localRequest.attendees[0]!.accommodation, false)
  assert.equal(awayRequest.attendees[0]!.accommodation, true)
  assert.equal(localRequest.registrationForm?.name, 'Jaipur local')
  await formService.saveRegistrationForm(staff, feeEvent!.id, { action: 'update', id: localForm.id, form: { ...baseForm, name: 'Jaipur local revised', studentFee: 90000 } })
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, localForm.token, { ...variantInput, requestKey: randomUUID() }), /fee or inclusions changed/)
  assert.equal((await service.getEventDetail(staff, feeEvent!.id)).registrationRequests.find(row => row.id === localRequest.id)!.prices.student, 50000)
  await service.reviewEventRegistration(staff, feeEvent!.id, localRequest.id, { action: 'approve' })
  await service.reviewEventRegistration(staff, feeEvent!.id, awayRequest.id, { action: 'approve' })
  feeDetail = await service.getEventDetail(staff, feeEvent!.id)
  assert.equal(feeDetail.finances!.bookingRevenue, 180000)
  assert.equal(feeDetail.occupancy.beds, 2)
  const localBooking = feeDetail.bookings.find(row => row.registrationForm?.id === localForm.id)!
  assert.equal(localBooking.balance.total, 50000)
  await assert.rejects(service.updateEventBooking(staff, feeEvent!.id, localBooking.id, { version: localBooking.version, attendees: localBooking.attendees.map(person => ({ ...person, underFive: false })) }), /fixed attendees and inclusions/)
  await formService.saveRegistrationForm(staff, feeEvent!.id, { action: 'delete', id: awayForm.id })
  await assert.rejects(publicService.publicRegistrationForm(publicHttp, awayForm.token), /unavailable/)
  assert.equal((await service.getEventDetail(staff, feeEvent!.id)).bookings.find(row => row.registrationForm?.id === awayForm.id)!.balance.total, 130000)
  const groupPeople = [{ type: 'student', name: 'Group Student', meal: 'Vegetarian' }, ...Array.from({ length: 10 }, (_, index) => ({ type: 'parent', name: `Guest ${index + 1}`, relationship: 'Guest', meal: 'Vegetarian' }))]
  const groupInput = { ...variantInput, requestKey: randomUUID(), formSignature: (await publicService.publicRegistrationForm(publicHttp, localForm.token)).event.formSignature!, attendees: groupPeople }
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, localForm.token, { ...groupInput, attendees: [...groupPeople, { type: 'parent', name: 'Eleventh guest' }] }), /At most ten accompanying people/)
  const groupSubmission = await publicService.submitPublicEventRegistration(publicHttp, localForm.token, groupInput)
  assert.equal(groupSubmission.quote, 290000)
  const groupRequest = (await service.getEventDetail(staff, feeEvent!.id)).registrationRequests.find(row => row.reference === groupSubmission.reference)!
  await service.reviewEventRegistration(staff, feeEvent!.id, groupRequest.id, { action: 'approve' })
  const groupBooking = (await service.getEventDetail(staff, feeEvent!.id)).bookings.find(row => row.registrationForm?.id === localForm.id && row.attendees.length === 11)!
  assert.equal(groupBooking.balance.total, 290000)
  assert.equal((await service.updateEventBooking(staff, feeEvent!.id, groupBooking.id, { version: groupBooking.version, attendees: groupBooking.attendees }))!.attendees.length, 11)
  console.log('PASS: separate local and outstation forms, ten accompanying people, fixed inclusions and price snapshots')
  const attendee = (type: 'student' | 'parent', name = '') => ({ type, name, relationship: type === 'parent' ? 'Mother' : '', meal: 'Jain', accommodation: true })
  const bookingInput = { requestKey: randomUUID(), studentId: students[0]!.id, attendees: [attendee('student'), attendee('parent')], contactName: 'Guardian', contactPhone: '9000000000', consent: { accepted: false, name: '', phone: '' } }
  const provisional = await service.createEventBooking(portal, event!.id, bookingInput)
  assert.equal(provisional!.status, 'provisional')
  assert.equal((await service.getEventDetail(staff, event!.id)).occupancy.people, 2)
  assert.equal((await service.createEventBooking(portal, event!.id, bookingInput))!.id, provisional!.id)
  await assert.rejects(service.createEventBooking(portal, event!.id, { ...bookingInput, requestKey: randomUUID() }), /already has an active booking/)
  await assert.rejects(service.createEventBooking(portal, event!.id, { ...bookingInput, requestKey: randomUUID(), studentId: students[1]!.id }), /only your own student/)
  await assert.rejects(service.getEventDetail({ ...staff, organizationId: otherOrg!.id }, event!.id), /Event not found/)
  assert.equal((await service.getEventDetail(otherStudent, event!.id)).bookings.length, 0)
  assert.equal((await service.getEventDetail(portal, event!.id)).finances, null)
  console.log('PASS: parent-free registration, idempotency, tenant isolation and portal ownership')

  const booking = await service.updateEventBooking(portal, event!.id, provisional!.id, { version: provisional!.version, attendees: provisional!.attendees.map(person => ({ ...person, name: person.type === 'parent' ? 'New Mother' : person.name })), consent: { accepted: true, name: 'New Mother', phone: '9000000000' }, saveGuardians: true })
  assert.equal(booking!.status, 'pending')
  const guardians = await db.select().from(tables.guardians)
  assert.equal(guardians.length, 1)
  await assert.rejects(service.updateEventBooking(portal, event!.id, booking!.id, { version: provisional!.version, notes: 'stale' }), /booking changed/)
  await assert.rejects(service.updateEventBooking(portal, event!.id, booking!.id, { version: booking!.version, discount: 1 }), /Only event managers/)
  await assert.rejects(service.updateEventBooking(staff, event!.id, booking!.id, { version: booking!.version, status: 'confirmed' }), /deposit or full payment/)
  const paymentInput = { requestKey: randomUUID(), kind: 'payment', bookingId: booking!.id, amount: 100000, method: 'upi', occurredOn: '2026-10-01', description: 'Booking deposit' }
  const payment = await service.addEventTransaction(staff, event!.id, paymentInput)
  assert.equal((await service.addEventTransaction(staff, event!.id, paymentInput))!.id, payment!.id)
  let detail = await service.getEventDetail(staff, event!.id)
  assert.equal(detail.bookings[0]!.status, 'confirmed')
  assert.equal(detail.bookings[0]!.balance.paid, 100000)
  await assert.rejects(service.addEventTransaction(portal, event!.id, { ...paymentInput, requestKey: randomUUID() }), /Only event managers/)
  console.log('PASS: guardian saving, optimistic edits, deposit confirmation and transaction authorization')

  const race = await Promise.allSettled(students.slice(1, 3).map(student => service.createEventBooking(staff, event!.id, { ...bookingInput, requestKey: randomUUID(), studentId: student.id, attendees: [attendee('student')] })))
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(race.filter(result => result.status === 'rejected').length, 1)
  detail = await service.getEventDetail(staff, event!.id)
  assert.equal(detail.occupancy.people, 3)
  const waiting = await service.createEventBooking(staff, event!.id, { ...bookingInput, requestKey: randomUUID(), studentId: students[3]!.id, attendees: [attendee('student')], waitlist: true })
  assert.equal(waiting!.status, 'waitlisted')
  assert.equal((await service.getEventDetail(staff, event!.id)).occupancy.people, 3)
  await assert.rejects(service.addEventTransaction(staff, event!.id, { ...paymentInput, requestKey: randomUUID(), bookingId: waiting!.id }), /waitlisted/)
  console.log('PASS: simultaneous registrations cannot overbook and waiting lists do not reserve places')

  await service.saveEvent(staff, { ...body, prices: { ...body.prices, student: 2000000 } }, event!.id)
  detail = await service.getEventDetail(staff, event!.id)
  assert.equal(detail.bookings.find(row => row.id === booking!.id)!.balance.total, 2900000)
  const current = detail.bookings.find(row => row.id === booking!.id)!
  await service.updateEventBooking(staff, event!.id, current.id, { version: current.version, status: 'cancelled', cancellationFee: 20000 })
  detail = await service.getEventDetail(staff, event!.id)
  assert.equal(detail.bookings.find(row => row.id === booking!.id)!.balance.credit, 80000)
  const refund = { requestKey: randomUUID(), kind: 'refund', bookingId: booking!.id, sourceId: payment!.id, amount: 80000, method: 'upi', occurredOn: '2026-10-02', description: 'Cancellation refund' }
  await service.addEventTransaction(staff, event!.id, refund)
  await assert.rejects(service.addEventTransaction(staff, event!.id, { ...refund, requestKey: randomUUID(), amount: 30000 }), /exceeds the remaining/)
  assert.equal((await service.getEventDetail(staff, event!.id)).bookings.find(row => row.id === booking!.id)!.balance.credit, 0)
  console.log('PASS: price snapshots, cancellation credits and original-payment refund limits')

  const cost = await service.addEventCost(staff, event!.id, { requestKey: randomUUID(), supplier: 'Hotel', description: 'Camp lodging', category: 'direct', amount: 500000, tax: 50000 })
  const settlement = await service.addEventTransaction(staff, event!.id, { requestKey: randomUUID(), kind: 'cost_payment', costId: cost!.id, amount: 100000, method: 'bank_transfer', occurredOn: '2026-10-01', description: 'Hotel deposit' })
  await assert.rejects(service.updateEventCost(staff, event!.id, cost!.id, 'cancelled'), /supplier refund/)
  await service.addEventTransaction(staff, event!.id, { requestKey: randomUUID(), kind: 'cost_refund', costId: cost!.id, sourceId: settlement!.id, amount: 100000, method: 'bank_transfer', occurredOn: '2026-10-02', description: 'Returned deposit' })
  await service.updateEventCost(staff, event!.id, cost!.id, 'cancelled')
  assert.equal((await db.select().from(tables.payments)).length, 0)
  assert.equal((await db.select().from(tables.expenses)).length, 0)
  console.log('PASS: supplier settlements and reversals leave tuition payments and existing expenses untouched')
  const remaining = (await service.getEventDetail(staff, event!.id)).bookings.filter(row => row.status !== 'cancelled')
  for (const row of remaining) await service.updateEventBooking(staff, event!.id, row.id, { version: row.version, status: 'cancelled', cancellationFee: 0 })
  await service.saveEvent(staff, { ...body, status: 'completed' }, event!.id)
  await assert.rejects(service.addEventCost(staff, event!.id, { requestKey: randomUUID(), supplier: 'Hotel', description: 'Future commitment', category: 'direct', amount: 10000 }), /incurred costs only/)
  await service.addEventCost(staff, event!.id, { requestKey: randomUUID(), supplier: 'Hotel', description: 'Late invoice', category: 'direct', amount: 10000, status: 'incurred' })
  console.log('PASS: completed events accept late actual invoices but not new commitments')
  const questionId = randomUUID()
  const customSettings = { ...defaultEventFormSettings, title: 'Join our camp', accentColor: '#164e63', letterBody: 'Please join our training camp.', questions: [{ id: questionId, label: 'Preferred workshop', type: 'select' as const, required: true, help: '', options: ['Kata', 'Kumite'] }] }
  const customEvent = await createLegacyEvent({ ...body, name: 'Custom camp', formSettings: customSettings })
  const customLink = await service.setPublicEventRegistration(staff, customEvent!.id, { action: 'enable' })
  Object.assign(globalThis, { getRequestURL: () => new URL('http://localhost:3118'), setHeader: () => {} })
  const invitation = await import('../server/utils/event-branded-invitation')
  const logoFile = `public/uploads/logos/${randomUUID()}.svg`
  mkdirSync('public/uploads/logos', { recursive: true })
  writeFileSync(logoFile, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="blue"/></svg>')
  try {
    await db.update(tables.organizations).set({ logo: `/${logoFile.slice('public/'.length)}` }).where(eq(tables.organizations.id, org!.id))
    const generatedPdf = await invitation.brandedEventInvitation(publicHttp, customEvent!.id, customLink.token!)
    assert.equal(generatedPdf.subarray(0, 5).toString(), '%PDF-')
    assert.ok(generatedPdf.includes(Buffer.from('/Subtype /Image')), 'The organization SVG logo appears in the PDF')
  } finally {
    await db.update(tables.organizations).set({ logo: null }).where(eq(tables.organizations.id, org!.id))
    rmSync(logoFile, { force: true })
  }
  const customInput = { ...guestInput, requestKey: randomUUID(), customAnswers: { [questionId]: 'Kata' } }
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, customLink.token!, { ...customInput, customAnswers: {} }), /Complete Preferred workshop/)
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, customLink.token!, { ...customInput, customAnswers: { [questionId]: 'Invalid' } }), /listed option/)
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, customLink.token!, customInput), /student photograph/)
  await assert.rejects(publicService.submitPublicEventRegistration(publicHttp, customLink.token!, customInput, { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), type: 'image/png' }), /photograph could not be read/)
  const photoData = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#789abc' } }).png().toBuffer()
  const customSubmission = await publicService.submitPublicEventRegistration(publicHttp, customLink.token!, customInput, { data: photoData, type: 'image/png' })
  assert.match(customSubmission.printToken!, /^[a-f0-9]{64}$/)
  assert.match(customSubmission.physicalCopyInstructions, /print and sign/i)
  let customDetail = await service.getEventDetail(staff, customEvent!.id)
  const customRequest = customDetail.registrationRequests[0]!
  assert.deepEqual(customRequest.customAnswers, [{ id: questionId, label: 'Preferred workshop', value: 'Kata' }])
  assert.match(customRequest.photoPath!, /^\/uploads\/event-photos\/.+\.jpg$/)
  const printable = await import('../server/utils/event-registration-pdf')
  const printed = await printable.eventRegistrationPdf(customSubmission.printToken!)
  assert.equal(printed.buffer.subarray(0, 5).toString(), '%PDF-')
  assert.ok(printed.buffer.includes(Buffer.from('/Subtype /Image')), 'Student photo appears on the printable form')
  await assert.rejects(service.reviewEventRegistration(staff, customEvent!.id, customRequest.id, { action: 'approve', mode: 'guest' }), /signed physical copy/)
  await service.markEventPhysicalCopy(staff, customEvent!.id, customRequest.id)
  assert.ok((await service.getEventDetail(staff, customEvent!.id)).registrationRequests[0]!.physicalCopyReceivedAt)
  await service.correctEventRegistration(staff, customEvent!.id, customRequest.id, { contactPhone: '9000000099' })
  await service.reviewEventRegistration(staff, customEvent!.id, customRequest.id, { action: 'approve', mode: 'guest' })
  rmSync(join(process.cwd(), 'public', customRequest.photoPath!), { force: true })
  await service.saveEvent(staff, { ...body, name: 'Custom camp', formSettings: { ...customSettings, questions: [{ ...customSettings.questions[0]!, label: 'Workshop choice' }] } }, customEvent!.id)
  customDetail = await service.getEventDetail(staff, customEvent!.id)
  assert.equal(customDetail.bookings[0]!.contactPhone, '9000000099')
  assert.equal(customDetail.bookings[0]!.customAnswers[0]!.label, 'Preferred workshop')
  const editableCost = await service.addEventCost(staff, customEvent!.id, { requestKey: randomUUID(), supplier: 'Bus', description: 'Transport', category: 'direct', amount: 10000 })
  await service.updateEventCost(staff, customEvent!.id, editableCost!.id, { supplier: 'Coach', amount: 12000 })
  assert.equal((await service.getEventDetail(staff, customEvent!.id)).costs[0]!.amount, 12000)
  await service.addEventTransaction(staff, customEvent!.id, { requestKey: randomUUID(), kind: 'cost_payment', costId: editableCost!.id, amount: 5000, method: 'cash', occurredOn: '2026-10-01', description: 'Deposit' })
  await assert.rejects(service.updateEventCost(staff, customEvent!.id, editableCost!.id, { amount: 13000 }), /Refund supplier payments/)
  await assert.rejects(service.deleteUnusedEvent(staff, customEvent!.id), /history/)
  const unusedEvent = await service.saveEvent(staff, { ...body, name: 'Unused camp', status: 'draft', registrationMode: 'public' })
  await service.deleteUnusedEvent(staff, unusedEvent!.id)
  assert.equal((await db.select().from(tables.campEvents).where(eq(tables.campEvents.id, unusedEvent!.id))).length, 0)
  console.log('PASS: custom questions, answer snapshots, request corrections, cost edits and safe event deletion')
  await db.delete(tables.dojos).where(eq(tables.dojos.id, dojo!.id))
  assert.ok((await db.select().from(tables.eventBookings)).every(row => row.dojoId === null))
  await db.delete(tables.organizations).where(eq(tables.organizations.id, org!.id))
  assert.equal((await db.select().from(tables.campEvents)).length, 0)
  assert.equal((await db.select().from(tables.eventLedger)).length, 0)
  console.log('PASS: existing dojo and workspace deletion workflows still work')
  console.log('All event integration checks passed.')
} finally {
  await connection?.end()
  if (created) {
    // The identifier is generated and validated above; the application database is never a target.
    await admin.unsafe(`DROP DATABASE "${testName}" WITH (FORCE)`)
  }
  await admin.end()
}
