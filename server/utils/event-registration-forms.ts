import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { EventPrices, EventRegistrationForm, EventRegistrationFormSnapshot } from '../../shared/types/events'
import { db, tables } from './database'
import { registrationFormSchema } from './event-validation'
import { canManageEvent } from './events'
import type { eventActor } from './events'

type Actor = Awaited<ReturnType<typeof eventActor>>

export function formSnapshot(form: EventRegistrationForm): EventRegistrationFormSnapshot {
  const { token: _token, enabled: _enabled, ...snapshot } = form
  return snapshot
}
export function formSignature(form: EventRegistrationForm) {
  return createHash('sha256').update(JSON.stringify(formSnapshot(form))).digest('hex')
}

export function formPrices(form: EventRegistrationForm): EventPrices {
  return { student: form.studentFee, parent: form.companionFee, accommodation: 0, transportOut: 0, transportReturn: 0, taxBps: form.taxBps }
}

export async function saveRegistrationForm(actor: Actor, eventId: number, input: unknown) {
  const action = z.object({ action: z.enum(['create', 'update', 'delete']), id: z.string().uuid().optional(), form: registrationFormSchema.optional() }).safeParse(input)
  if (!action.success) throw createError({ statusCode: 400, statusMessage: 'Invalid registration form settings' })
  const { action: operation, id, form } = action.data
  if ((operation === 'create' && !form) || (operation !== 'create' && !id) || (operation === 'update' && !form)) throw createError({ statusCode: 400, statusMessage: 'Form details are required' })
  return db.transaction(async tx => {
    const [event] = await tx.select().from(tables.campEvents).where(and(eq(tables.campEvents.id, eventId), eq(tables.campEvents.organizationId, actor.organizationId))).for('update')
    if (!event) throw createError({ statusCode: 404, statusMessage: 'Event not found' })
    if (!canManageEvent(actor, event)) throw createError({ statusCode: 403, statusMessage: 'Only event managers can manage registration forms' })
    if (event.registrationMode !== 'public') throw createError({ statusCode: 400, statusMessage: 'Separate registration forms require an organization event' })
    if (form && !event.transportProvided && (form.includesTransportOut || form.includesTransportReturn)) throw createError({ statusCode: 400, statusMessage: 'Transport is not provided for this event' })
    const forms = [...event.registrationForms]
    const position = forms.findIndex(row => row.id === id)
    if (operation !== 'create' && position < 0) throw createError({ statusCode: 404, statusMessage: 'Registration form not found' })
    let result: EventRegistrationForm | null = null
    if (operation === 'create') {
      if (forms.length >= 20) throw createError({ statusCode: 400, statusMessage: 'This event already has 20 registration forms' })
      result = { ...form!, id: randomUUID(), token: randomBytes(32).toString('hex') }
      forms.push(result)
    } else if (operation === 'update') {
      result = { ...forms[position]!, ...form! }
      forms[position] = result
    } else forms.splice(position, 1)
    await tx.update(tables.campEvents).set({ registrationForms: forms, updatedAt: new Date() }).where(eq(tables.campEvents.id, eventId))
    await tx.insert(tables.eventActivity).values({ eventId, actor: actor.label, action: `registration.form.${operation}`, details: result?.name || id! })
    return { form: result, forms }
  })
}
