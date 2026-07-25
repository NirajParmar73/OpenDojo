import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const schedules = await db.select().from(tables.gradingFeeSchedules).where(eq(tables.gradingFeeSchedules.organizationId, session.user.organizationId))
  const [dojos, ranks, plans] = await Promise.all([
    db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, session.user.organizationId) }),
    db.query.beltRanks.findMany(),
    db.query.feePlans.findMany({ where: eq(tables.feePlans.organizationId, session.user.organizationId) }),
  ])
  return schedules.map(schedule => ({ ...schedule, dojo: dojos.find(dojo => dojo.id === schedule.dojoId), beltRank: ranks.find(rank => rank.id === schedule.beltRankId), feePlan: plans.find(plan => plan.id === schedule.feePlanId) }))
})
