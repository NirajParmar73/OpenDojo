import { z } from 'zod'
import { defaultEventFormSettings, type EventAnswer, type EventFormSettings } from '../../shared/types/events'

const money = z.number().int().min(0).max(100_000_000)
const text = (max = 250) => z.string().trim().max(max)
const questionSchema = z.object({
  id: z.string().uuid(), label: text(120).min(1), type: z.enum(['text', 'textarea', 'select', 'checkbox', 'date']),
  required: z.boolean(), help: text(300), options: z.array(text(100).min(1)).max(20),
}).superRefine((question, ctx) => {
  if (question.type === 'select' && (question.options.length < 2 || new Set(question.options.map(option => option.toLowerCase())).size !== question.options.length)) ctx.addIssue({ code: 'custom', message: 'Selection questions need at least two distinct options' })
})
export const eventFormSettingsSchema = z.object({
  title: text(160), introduction: text(3000), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  privacyNotice: text(3000), submitLabel: text(80).min(1), confirmationMessage: text(2000),
  letterHeading: text(160).min(1), letterBody: text(10000), contactText: text(1000),
  requirePhoto: z.boolean().default(false), requirePhysicalCopy: z.boolean().default(false), physicalCopyInstructions: text(2000).default(''),
  questions: z.array(questionSchema).max(20),
}).superRefine((value, ctx) => {
  if (new Set(value.questions.map(question => question.id)).size !== value.questions.length) ctx.addIssue({ code: 'custom', message: 'Each custom question needs a unique ID' })
})
export function validateEventAnswers(settings: EventFormSettings, raw: unknown): EventAnswer[] {
  const result = z.record(z.string().uuid(), z.union([z.string().max(3000), z.boolean()])).safeParse(raw || {})
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid custom answers' })
  const answers = result.data
  const ids = new Set(settings.questions.map(question => question.id))
  if (Object.keys(answers).some(id => !ids.has(id))) throw createError({ statusCode: 400, statusMessage: 'The registration form changed. Reload it before submitting.' })
  return settings.questions.map(question => {
    const input = answers[question.id]
    const value = typeof input === 'string' ? input.trim() : input ?? (question.type === 'checkbox' ? false : '')
    if (question.required && (value === '' || value === false)) throw createError({ statusCode: 400, statusMessage: `Complete ${question.label}` })
    if (question.type === 'checkbox' && typeof value !== 'boolean') throw createError({ statusCode: 400, statusMessage: `Invalid answer for ${question.label}` })
    if (question.type !== 'checkbox' && typeof value !== 'string') throw createError({ statusCode: 400, statusMessage: `Invalid answer for ${question.label}` })
    if (question.type === 'select' && value && !question.options.includes(value as string)) throw createError({ statusCode: 400, statusMessage: `Choose a listed option for ${question.label}` })
    if (question.type === 'date' && value && !z.string().date().safeParse(value).success) throw createError({ statusCode: 400, statusMessage: `Enter a date for ${question.label}` })
    if (question.type === 'text' && typeof value === 'string' && value.length > 500) throw createError({ statusCode: 400, statusMessage: `${question.label} is too long` })
    return { id: question.id, label: question.label, value }
  })
}
export const eventSchema = z.object({
  name: text().min(1), description: text(10000).default(''), venue: text(1000).default(''),
  startDate: z.string().date(), endDate: z.string().date(), registrationDeadline: z.string().date(), detailsDeadline: z.string().date().nullable().default(null),
  status: z.enum(['draft', 'open', 'closed', 'completed', 'cancelled']).default('draft'),
  registrationMode: z.enum(['public', 'linked']).default('public'),
  transportProvided: z.boolean().default(true),
  dojoIds: z.array(z.number().int().positive()).max(500).default([]),
  capacity: z.number().int().min(0).max(100000).default(0), bedCapacity: z.number().int().min(0).max(100000).default(0), outboundCapacity: z.number().int().min(0).max(100000).default(0), returnCapacity: z.number().int().min(0).max(100000).default(0),
  prices: z.object({ student: money, parent: money, transportOut: money, transportReturn: money, accommodation: money, taxBps: z.number().int().min(0).max(10000) }),
  confirmationRule: z.enum(['staff', 'deposit', 'full']).default('staff'), deposit: money.default(0),
  terms: text(20000).default(''), instructions: text(20000).default(''),
  formSettings: eventFormSettingsSchema.default(defaultEventFormSettings),
  fixedBudget: money.default(0), perPersonBudget: money.default(0), overheadBudget: money.default(0),
}).superRefine((value, ctx) => {
  if (value.endDate < value.startDate) ctx.addIssue({ code: 'custom', message: 'End date must follow start date' })
  if (value.registrationDeadline > value.startDate) ctx.addIssue({ code: 'custom', message: 'Registration deadline must be on or before the start date' })
  if (value.detailsDeadline && value.detailsDeadline > value.startDate) ctx.addIssue({ code: 'custom', message: 'Details deadline must be on or before the start date' })
  if (value.confirmationRule === 'deposit' && !value.deposit) ctx.addIssue({ code: 'custom', message: 'Set a positive booking deposit' })
  if (value.status === 'open' && !value.terms) ctx.addIssue({ code: 'custom', message: 'Add participation and cancellation terms before opening registration' })
})

export const attendeeSchema = z.object({
  id: z.string().uuid().optional(), type: z.enum(['student', 'parent']),
  name: text(), relationship: text(100).default(''), phone: text(60).default(''), email: z.union([z.email(), z.literal('')]).default(''),
  meal: text(100).default(''), medicalNotes: text(2000).default(''),
  transportOut: z.boolean().default(false), transportReturn: z.boolean().default(false), accommodation: z.boolean().default(false),
  room: text(100).default(''), busOut: text(100).default(''), busReturn: text(100).default(''),
})
export const bookingSchema = z.object({
  studentId: z.number().int().positive(), requestKey: z.string().uuid(),
  attendees: z.array(attendeeSchema).min(1).max(3),
  contactName: text(), contactPhone: text(60), emergencyName: text().default(''), emergencyPhone: text(60).default(''),
  consent: z.object({ name: text(), phone: text(60), accepted: z.boolean() }),
  discount: money.default(0), notes: text(3000).default(''),
  saveGuardians: z.boolean().default(false), waitlist: z.boolean().default(false),
}).refine(value => value.attendees.filter(person => person.type === 'student').length === 1, 'A booking must contain one student and up to two parents')

export const publicEventRegistrationSchema = z.object({
  requestKey: z.string().uuid(), sourceType: z.enum(['internal', 'external']).default('internal'), dojoId: z.number().int().positive().nullable().default(null),
  sourceDojoName: text(250).default(''), sourceCity: text(150).default(''), sourceState: text(150).default(''), sourceCountry: text(150).default(''), instructorName: text(250).default(''),
  dateOfBirth: z.string().date(), membershipNumber: text(100).default(''),
  attendees: z.array(attendeeSchema).min(1).max(3),
  contactName: text().min(1), contactPhone: text(60).min(5),
  emergencyName: text().default(''), emergencyPhone: text(60).default(''),
  consent: z.object({ name: text().min(1), phone: text(60).min(5), accepted: z.literal(true) }),
  notes: text(3000).default(''), waitlist: z.boolean().default(false),
  customAnswers: z.record(z.string().uuid(), z.union([z.string().max(3000), z.boolean()])).default({}),
  website: z.string().max(0).default(''),
}).superRefine((value, ctx) => {
  if (value.attendees.filter(person => person.type === 'student').length !== 1 || !value.attendees.find(person => person.type === 'student')?.name.trim()) ctx.addIssue({ code: 'custom', message: 'Enter one student name and up to two parents' })
})
export const eventRequestCorrectionSchema = z.object({
  studentName: text().min(1).optional(), dateOfBirth: z.string().date().optional(), membershipNumber: text(100).optional(),
  contactName: text().min(1).optional(), contactPhone: text(60).min(5).optional(), emergencyName: text().optional(), emergencyPhone: text(60).optional(),
  sourceDojoName: text(250).optional(), sourceCity: text(150).optional(), sourceState: text(150).optional(), sourceCountry: text(150).optional(), instructorName: text(250).optional(),
  notes: text(3000).optional(),
}).refine(value => Object.keys(value).length > 0, 'Enter a correction')

export const bookingUpdateSchema = z.object({
  version: z.number().int().positive(),
  guestProfile: z.object({ dateOfBirth: z.string().date(), membershipNumber: text(100), dojoName: text(250), city: text(150).optional(), state: text(150), country: text(150), instructorName: text(250).optional() }).optional(),
  attendees: z.array(attendeeSchema).min(1).max(3).optional(),
  contactName: text().optional(), contactPhone: text(60).optional(), emergencyName: text().optional(), emergencyPhone: text(60).optional(),
  consent: z.object({ name: text(), phone: text(60), accepted: z.boolean() }).optional(),
  discount: money.optional(), cancellationFee: money.optional(), notes: text(3000).optional(),
  status: z.enum(['provisional', 'pending', 'confirmed', 'waitlisted', 'cancelled']).optional(),
  checkInId: z.string().uuid().optional(), checkIn: z.boolean().optional(), saveGuardians: z.boolean().default(false),
})

export const ledgerSchema = z.object({
  requestKey: z.string().uuid(), kind: z.enum(['payment', 'refund', 'income', 'income_refund', 'cost_payment', 'cost_refund']),
  bookingId: z.number().int().positive().nullable().default(null), costId: z.number().int().positive().nullable().default(null), sourceId: z.number().int().positive().nullable().default(null),
  amount: money.refine(value => value > 0, 'Enter a positive amount'), tax: money.default(0),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other']), reference: text().default(''), description: text(2000).min(1), occurredOn: z.string().date(),
})
export const costSchema = z.object({
  requestKey: z.string().uuid(), description: text(1000).min(1), supplier: text().min(1), category: z.enum(['direct', 'overhead']),
  amount: money, tax: money.default(0), status: z.enum(['committed', 'incurred']).default('committed'),
  dueDate: z.string().date().nullable().default(null), invoiceNumber: text().default(''), notes: text(3000).default(''),
})
export const costUpdateSchema = z.object({
  description: text(1000).min(1).optional(), supplier: text().min(1).optional(), category: z.enum(['direct', 'overhead']).optional(),
  amount: money.optional(), tax: money.optional(), status: z.enum(['committed', 'incurred', 'cancelled']).optional(),
  dueDate: z.string().date().nullable().optional(), invoiceNumber: text().optional(), notes: text(3000).optional(),
}).refine(value => Object.keys(value).length > 0, 'Enter a cost change')
