import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getAllowedAssignmentsForCreator } from '../../utils/permissions'

const schema = z.object({
  governingBodyId: z.number().int().positive(),
  scopeType: z.enum(['organization', 'node', 'dojo']),
  scopeId: z.number().int().positive().nullable(),
  relationshipType: z.enum(['parent_affiliation', 'membership', 'recognition', 'license', 'accreditation']),
  status: z.enum(['pending', 'active', 'expired', 'suspended']),
  renewalDueAt: z.string().date().optional().nullable()
}).refine(body => body.scopeType === 'organization' ? body.scopeId === null : body.scopeId !== null, { message: 'Select a valid scope' })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid affiliation' })

  const organizationId = session.user.organizationId
  const existing = await db.query.affiliations.findFirst({ where: and(eq(tables.affiliations.id, id), eq(tables.affiliations.organizationId, organizationId)) })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Affiliation not found' })

  const body = await readValidatedBody(event, schema.parse)
  const isOwner = session.user.role === 'owner'
  const allowed = isOwner ? null : await getAllowedAssignmentsForCreator(session.user.id, organizationId)
  const canManage = (scopeType: string, scopeId: number | null) => isOwner || (scopeType === 'node' && !!scopeId && allowed!.allowedNodeIds.includes(scopeId)) || (scopeType === 'dojo' && !!scopeId && allowed!.allowedDojoIds.includes(scopeId))
  if (!canManage(existing.scopeType, existing.scopeId) || !canManage(body.scopeType, body.scopeId)) throw createError({ statusCode: 403, statusMessage: 'This affiliation is outside your assigned territory' })

  const governingBody = await db.query.governingBodies.findFirst({ where: and(eq(tables.governingBodies.id, body.governingBodyId), eq(tables.governingBodies.organizationId, organizationId)) })
  if (!governingBody) throw createError({ statusCode: 400, statusMessage: 'Invalid governing body' })

  const [affiliation] = await db.update(tables.affiliations).set({ ...body, renewalDueAt: body.renewalDueAt ? new Date(body.renewalDueAt) : null, updatedAt: new Date() }).where(eq(tables.affiliations.id, id)).returning()
  return { success: true, affiliation }
})
