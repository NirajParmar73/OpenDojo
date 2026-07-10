import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

const updateRankSchema = z.object({
  name: z.string().min(1).optional(),
  level: z.string().min(1).optional(),
  order: z.number().int().optional(),
  type: z.enum(['kyu', 'dan']).optional(),
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

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const body = await readValidatedBody(event, updateRankSchema.parse)

  // Fetch the rank with its system
  const rank = await db.query.beltRanks.findFirst({
    where: eq(tables.beltRanks.id, Number(id)),
    with: { system: true },
  }) as any // 👈 cast to any

  if (!rank) {
    throw createError({ statusCode: 404, statusMessage: 'Rank not found' })
  }

  // Check ownership
  if (rank.system.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Rank not found' })
  }

  const updateData: any = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.level !== undefined) updateData.level = body.level
  if (body.order !== undefined) updateData.order = body.order
  if (body.type !== undefined) updateData.type = body.type
  if (body.danNumber !== undefined) updateData.danNumber = body.danNumber
  if (body.color !== undefined) updateData.color = body.color
  if (body.description !== undefined) updateData.description = body.description
  updateData.updatedAt = new Date()

  const [updated] = await db.update(tables.beltRanks)
    .set(updateData)
    .where(eq(tables.beltRanks.id, Number(id)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update rank' })
  }

  return { success: true, rank: updated }
})