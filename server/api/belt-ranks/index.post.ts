import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

const createRankSchema = z.object({
  name: z.string().min(1),
  level: z.string().min(1),
  order: z.number().int(),
  type: z.enum(['kyu', 'dan']),
  danNumber: z.number().int().optional().nullable(),
  color: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const body = await readValidatedBody(event, createRankSchema.parse)

  // Get or create the belt system
  let system = await db.query.beltSystems.findFirst({
    where: eq(tables.beltSystems.organizationId, orgId),
  })

  if (!system) {
    const [newSystem] = await db.insert(tables.beltSystems).values({
      organizationId: orgId,
      name: 'Default Belt System',
    }).returning()
    system = newSystem
  }

  // ✅ Explicit check to satisfy TypeScript
  if (!system) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create or find belt system' })
  }

  const [rank] = await db.insert(tables.beltRanks).values({
    systemId: system.id,
    name: body.name,
    level: body.level,
    order: body.order,
    type: body.type,
    danNumber: body.danNumber || null,
    color: body.color || null,
    description: body.description || null,
  }).returning() as any[]

  if (!rank) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create rank' })
  }

  return { success: true, rank }
})