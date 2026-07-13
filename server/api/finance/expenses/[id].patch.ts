import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { assertDojoManagementAccess, assertNodeManagementAccess } from '../../../utils/permissions'

const schema = z.object({
  category: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(1000), amount: z.number().int().positive(),
  scopeType: z.enum(['organization', 'node', 'dojo']), scopeId: z.number().int().positive().nullable(), affiliationId: z.number().int().positive().nullable(),
  payee: z.string().trim().max(255).nullable(), invoiceNumber: z.string().trim().max(255).nullable(), dueAt: z.string().date().nullable(),
  status: z.enum(['draft', 'due', 'partially_paid', 'paid', 'overdue', 'cancelled']), paidAt: z.string().date().nullable(), paymentMethod: z.enum(['cash', 'bank_transfer', 'card', 'upi', 'other']).nullable(), notes: z.string().trim().max(5000).nullable(),
}).refine(body => body.scopeType === 'organization' ? body.scopeId === null : body.scopeId !== null, { message: 'Select a valid scope' })

export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, schema.parse)
  const existing = await db.query.expenses.findFirst({ where: and(eq(tables.expenses.id, id), eq(tables.expenses.organizationId, session.user.organizationId)) })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Expense not found' })
  const assertScope = async (scopeType: string, scopeId: number | null) => {
    if (scopeType === 'organization' && session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the owner can manage organization-wide expenses' })
    if (scopeType === 'node') await assertNodeManagementAccess(session.user.id, session.user.organizationId!, scopeId!)
    if (scopeType === 'dojo') await assertDojoManagementAccess(session.user.id, session.user.organizationId!, scopeId!)
  }
  await assertScope(existing.scopeType, existing.scopeId)
  await assertScope(body.scopeType, body.scopeId)
  const [expense] = await db.update(tables.expenses).set({ ...body, dueAt: body.dueAt ? new Date(body.dueAt) : null, paidAt: body.status === 'paid' ? (body.paidAt ? new Date(body.paidAt) : new Date()) : null, updatedAt: new Date() }).where(and(eq(tables.expenses.id, id), eq(tables.expenses.organizationId, session.user.organizationId))).returning()
  return { success: true, expense }
})
