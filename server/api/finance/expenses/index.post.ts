import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { and, eq } from 'drizzle-orm'
import { assertDojoManagementAccess, assertNodeManagementAccess } from '../../../utils/permissions'

const bodySchema = z.object({
  affiliationId: z.number().int().positive().nullable().optional(),
  scopeType: z.enum(['organization', 'node', 'dojo']),
  scopeId: z.number().int().positive().nullable(),
  category: z.string().trim().min(1).max(100),
  payee: z.string().trim().max(255).optional(),
  description: z.string().trim().min(1).max(1000),
  invoiceNumber: z.string().trim().max(255).optional(),
  amount: z.number().int().positive(),
  taxAmount: z.number().int().nonnegative().default(0),
  incurredAt: z.string().date(),
  dueAt: z.string().date().optional(),
  paidAt: z.string().date().optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'upi', 'other']).optional(),
  paymentReference: z.string().trim().max(255).optional(),
  status: z.enum(['draft', 'due', 'partially_paid', 'paid', 'overdue', 'cancelled']).default('due'),
  notes: z.string().trim().max(5000).optional()
}).refine(body => body.scopeType === 'organization' ? body.scopeId === null : body.scopeId !== null, { message: 'Select a valid scope' })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, bodySchema.parse)
  if (body.scopeType === 'organization' && session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the owner can record organization-wide expenses' })
  if (body.scopeType === 'node') await assertNodeManagementAccess(session.user.id, session.user.organizationId, body.scopeId!)
  if (body.scopeType === 'dojo') await assertDojoManagementAccess(session.user.id, session.user.organizationId, body.scopeId!)
  if (body.affiliationId) {
    const affiliation = await db.query.affiliations.findFirst({ where: and(eq(tables.affiliations.id, body.affiliationId), eq(tables.affiliations.organizationId, session.user.organizationId)) })
    if (!affiliation) throw createError({ statusCode: 400, statusMessage: 'Invalid affiliation' })
  }
  const [expense] = await db.insert(tables.expenses).values({
    organizationId: session.user.organizationId,
    createdBy: session.user.id,
    ...body,
    payee: body.payee || null,
    invoiceNumber: body.invoiceNumber || null,
    notes: body.notes || null,
    affiliationId: body.affiliationId || null,
    incurredAt: new Date(body.incurredAt),
    dueAt: body.dueAt ? new Date(body.dueAt) : null,
    paidAt: body.paidAt ? new Date(body.paidAt) : null,
    paymentMethod: body.paymentMethod || null,
    paymentReference: body.paymentReference || null,
  }).returning()
  return { success: true, expense }
})
