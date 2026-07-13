import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'
import { assertNodeManagementAccess } from '../../utils/permissions'

const createDojoSchema = z.object({
  nodeId: z.number().int().positive(),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }


  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const body = await readValidatedBody(event, createDojoSchema.parse)

  // Verify node belongs to the organization
  const node = await db.query.hierarchyNodes.findFirst({
    where: eq(tables.hierarchyNodes.id, body.nodeId),
  })
  if (!node || node.organizationId !== orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid node ID' })
  }
  await assertNodeManagementAccess(session.user.id, orgId, body.nodeId)

  const [dojo] = await db.insert(tables.dojos).values({
    organizationId: orgId,
    nodeId: body.nodeId,
    name: body.name,
    address: body.address || null,
    phone: body.phone || null,
    email: body.email || null,
  }).returning() as any[]

  if (!dojo) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create dojo' })
  }

  return { success: true, dojo }
})
