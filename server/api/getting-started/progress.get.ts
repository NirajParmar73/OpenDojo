import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const entries = await db.query.onboardingProgress.findMany({
    where: eq(tables.onboardingProgress.userId, session.user.id),
    columns: { stepKey: true },
  })
  return { completedStepKeys: entries.map(entry => entry.stepKey) }
})
