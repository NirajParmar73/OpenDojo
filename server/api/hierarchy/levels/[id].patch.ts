import { z } from 'zod'
import { db, tables } from '../../../../server/utils/database'
import { eq } from 'drizzle-orm'

const updateLevelSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const body = await readValidatedBody(event, updateLevelSchema.parse)

  // Verify level belongs to the organization
  const existing = await db.query.hierarchyLevels.findFirst({
    where: eq(tables.hierarchyLevels.id, Number(id)),
  })
  if (!existing || existing.organizationId !== session.user.organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Level not found' })
  }

  const [updated] = await db.update(tables.hierarchyLevels)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(tables.hierarchyLevels.id, Number(id)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update level' })
  }

  return { success: true, level: updated }
})