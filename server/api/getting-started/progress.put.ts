import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../utils/database'

const bodySchema = z.object({
  stepKey: z.string().trim().regex(/^[a-z]+:[a-z0-9-]+$/).max(100),
  completed: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const { stepKey, completed } = bodySchema.parse(await readBody(event))
  const where = and(eq(tables.onboardingProgress.userId, session.user.id), eq(tables.onboardingProgress.stepKey, stepKey))

  if (completed) {
    const existing = await db.query.onboardingProgress.findFirst({ where })
    if (!existing) await db.insert(tables.onboardingProgress).values({ userId: session.user.id, stepKey })
  } else {
    await db.delete(tables.onboardingProgress).where(where)
  }

  return { stepKey, completed }
})
