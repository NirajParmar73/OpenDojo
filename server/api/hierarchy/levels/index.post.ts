import { z } from 'zod'
import { db, tables } from '../../../../server/utils/database'
import { and, eq, gte, sql } from 'drizzle-orm'
import { assertHierarchyLevelAllowed } from '../../../utils/subscription'

const createLevelSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized – please log in' })
  }

  if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const body = await readValidatedBody(event, createLevelSchema.parse)
  await assertHierarchyLevelAllowed(orgId, body.name)

  let order = body.order
  if (order) {
    // A type deliberately inserted at the top (for example Country) pushes
    // existing types down while keeping their relative ordering intact.
    await db.update(tables.hierarchyLevels)
      .set({ order: sql`${tables.hierarchyLevels.order} + 1`, updatedAt: new Date() })
      .where(and(eq(tables.hierarchyLevels.organizationId, orgId), gte(tables.hierarchyLevels.order, order)))
  } else {
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
