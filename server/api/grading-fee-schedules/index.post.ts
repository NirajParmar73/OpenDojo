import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { assertDojoManagementAccess } from '../../utils/permissions'

const bodySchema = z.object({ dojoIds: z.array(z.number().int().positive()).min(1), beltRankId: z.number().int().positive(), amount: z.number().int().positive() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const [dojos, rank, existing] = await Promise.all([
    db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, session.user.organizationId) }),
    db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, body.beltRankId), with: { system: true } }),
    db.query.gradingFeeSchedules.findMany({ where: and(eq(tables.gradingFeeSchedules.organizationId, session.user.organizationId), eq(tables.gradingFeeSchedules.beltRankId, body.beltRankId)) }),
  ])
  const selectedDojos = dojos.filter(dojo => body.dojoIds.includes(dojo.id))
  if (selectedDojos.length !== body.dojoIds.length || !rank || rank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Choose valid dojos and belt rank' })
  for (const dojo of selectedDojos) await assertDojoManagementAccess(session.user.id, session.user.organizationId, dojo.id)
  const duplicate = existing.find(schedule => body.dojoIds.includes(schedule.dojoId))
  if (duplicate) throw createError({ statusCode: 409, statusMessage: 'One or more selected dojos already have a fee for that belt' })
  const created = []
  for (const dojo of selectedDojos) {
    const [feePlan] = await db.insert(tables.feePlans).values({ organizationId: session.user.organizationId, dojoId: dojo.id, name: `Grading – ${rank.name}`, amount: body.amount, frequency: 'one-time', description: `Automatic grading fee for ${rank.name}`, isActive: 1 }).returning()
    const [schedule] = await db.insert(tables.gradingFeeSchedules).values({ organizationId: session.user.organizationId, dojoId: dojo.id, beltRankId: rank.id, feePlanId: feePlan.id }).returning()
    created.push({ schedule, feePlan })
  }
  return { created }
})
