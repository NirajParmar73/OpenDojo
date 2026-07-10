import { z } from 'zod'
import { db, tables } from '../../../../server/utils/database'
import { eq } from 'drizzle-orm'

const createLevelSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized – please log in' })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const body = await readValidatedBody(event, createLevelSchema.parse)

  let order = body.order
  if (!order) {
    const maxOrder = await db.query.hierarchyLevels.findFirst({
      where: eq(tables.hierarchyLevels.organizationId, orgId),
      orderBy: (levels, { desc }) => [desc(levels.order)],
    })
    order = (maxOrder?.order ?? 0) + 1
  }

  const [level] = await db.insert(tables.hierarchyLevels).values({
    organizationId: orgId, // ✅ now it's definitely a number
    name: body.name,
    order,
  }).returning()

  return { success: true, level }
})