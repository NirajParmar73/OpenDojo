import { z } from 'zod'
import { eventActor, getEventDetail, reviewEventRegistration } from '../../../../utils/events'

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  requests: z.array(z.object({ id: z.number().int().positive(), mode: z.enum(['existing', 'guest']).default('guest'), studentId: z.number().int().positive().optional(), waitlist: z.boolean().default(false) })).min(1).max(100),
}).refine(body => new Set(body.requests.map(row => row.id)).size === body.requests.length, 'Select each request once')

export default defineEventHandler(async http => {
  const parsed = schema.safeParse(await readBody(http))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues.map(issue => issue.message).join('; ') })
  const id = Number(getRouterParam(http, 'id'))
  const actor = await eventActor(http)
  const detail = await getEventDetail(actor, id)
  if (!detail.canManage) throw createError({ statusCode: 403, statusMessage: 'Event manager access required' })
  const results: { id: number, reference: string, ok: boolean, error?: string }[] = []
  for (const row of parsed.data.requests) {
    const reference = detail.registrationRequests.find(request => request.id === row.id)?.reference || `#${row.id}`
    try {
      await reviewEventRegistration(actor, id, row.id, { action: parsed.data.action, mode: row.mode, studentId: row.studentId, waitlist: row.waitlist })
      results.push({ id: row.id, reference, ok: true })
    } catch (error: any) {
      results.push({ id: row.id, reference, ok: false, error: error.statusMessage || 'Could not review request' })
    }
  }
  return { approvedOrRejected: results.filter(row => row.ok).length, failed: results.filter(row => !row.ok).length, results }
})
