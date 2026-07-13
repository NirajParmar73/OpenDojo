import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { and, eq } from 'drizzle-orm'
import { getAllowedAssignmentsForCreator } from '../../utils/permissions'

const bodySchema = z.object({
  governingBodyId: z.number().int().positive(),
  scopeType: z.enum(['organization', 'node', 'dojo']),
  scopeId: z.number().int().positive().nullable(),
  relationshipType: z.enum(['parent_affiliation', 'membership', 'recognition', 'license', 'accreditation']),
  membershipNumber: z.string().trim().max(255).optional(),
  status: z.enum(['pending', 'active', 'expired', 'suspended']).default('pending'),
  startedAt: z.string().date().optional(),
  expiresAt: z.string().date().optional(),
  renewalDueAt: z.string().date().optional(),
  feeAmount: z.number().int().nonnegative().nullable().optional(),
  feeFrequency: z.enum(['one_time', 'monthly', 'quarterly', 'annual']).nullable().optional(),
  notes: z.string().trim().max(5000).optional()
}).refine(body => body.scopeType === 'organization' ? body.scopeId === null : body.scopeId !== null, { message: 'Select a valid scope' })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const isOwner = session.user.role === 'owner'
  const allowed = isOwner ? null : await getAllowedAssignmentsForCreator(session.user.id, session.user.organizationId)
  if (!isOwner && (!allowed || (allowed.allowedNodeIds.length === 0 && allowed.allowedDojoIds.length === 0))) throw createError({ statusCode: 403, statusMessage: 'No hierarchy scope is assigned to this account' })
  if (!isOwner && body.scopeType === 'organization') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can manage organization-wide affiliations' })
  if (!isOwner && body.scopeType === 'node' && !allowed!.allowedNodeIds.includes(body.scopeId!)) throw createError({ statusCode: 403, statusMessage: 'This hierarchy node is outside your assigned territory' })
  if (!isOwner && body.scopeType === 'dojo' && !allowed!.allowedDojoIds.includes(body.scopeId!)) throw createError({ statusCode: 403, statusMessage: 'This dojo is outside your assigned territory' })
  const governingBody = await db.query.governingBodies.findFirst({ where: and(eq(tables.governingBodies.id, body.governingBodyId), eq(tables.governingBodies.organizationId, session.user.organizationId)) })
  if (!governingBody) throw createError({ statusCode: 400, statusMessage: 'Invalid governing body' })
  if (body.scopeType === 'node') {
    const node = await db.query.hierarchyNodes.findFirst({ where: and(eq(tables.hierarchyNodes.id, body.scopeId!), eq(tables.hierarchyNodes.organizationId, session.user.organizationId)) })
    if (!node) throw createError({ statusCode: 400, statusMessage: 'Invalid hierarchy node' })
  }
  if (body.scopeType === 'dojo') {
    const dojo = await db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, body.scopeId!), eq(tables.dojos.organizationId, session.user.organizationId)) })
    if (!dojo) throw createError({ statusCode: 400, statusMessage: 'Invalid dojo' })
  }
  const [affiliation] = await db.insert(tables.affiliations).values({
    organizationId: session.user.organizationId,
    ...body,
    membershipNumber: body.membershipNumber || null,
    notes: body.notes || null,
    startedAt: body.startedAt ? new Date(body.startedAt) : null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    renewalDueAt: body.renewalDueAt ? new Date(body.renewalDueAt) : null
  }).returning()
  return { success: true, affiliation }
})
