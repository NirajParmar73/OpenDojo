import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess } from '../../../../utils/permissions'

const updateSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  name: z.string().min(1).optional(),
  instructorId: z.number().int().positive().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dojoId = getRouterParam(event, 'dojoId')
  const scheduleId = getRouterParam(event, 'id')
  if (!dojoId || !scheduleId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify dojo belongs to organization
  const dojo = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, orgId)
    ),
  })
  if (!dojo) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }
  await assertDojoManagementAccess(session.user.id, orgId, Number(dojoId))

  // Verify schedule exists and belongs to dojo
  const existing = await db.query.dojoSchedules.findFirst({
    where: and(
      eq(tables.dojoSchedules.id, Number(scheduleId)),
      eq(tables.dojoSchedules.dojoId, Number(dojoId))
    ),
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })
  }

  const body = await readValidatedBody(event, updateSchema.parse)

  // If instructorId provided, verify it
  if (body.instructorId !== undefined && body.instructorId !== null) {
    const instructor = await db.query.users.findFirst({
      where: and(
        eq(tables.users.id, body.instructorId),
        eq(tables.users.organizationId, orgId)
      ),
    })
    if (!instructor) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid instructor' })
    }
    if (!['owner', 'instructor'].includes(instructor.role)) {
      throw createError({ statusCode: 400, statusMessage: 'User is not an instructor' })
    }
  }

  const updateData: any = {}
  if (body.dayOfWeek !== undefined) updateData.dayOfWeek = body.dayOfWeek
  if (body.startTime !== undefined) updateData.startTime = body.startTime
  if (body.endTime !== undefined) updateData.endTime = body.endTime
  if (body.name !== undefined) updateData.name = body.name
  if (body.instructorId !== undefined) updateData.instructorId = body.instructorId
  updateData.updatedAt = new Date()

  const [updated] = await db.update(tables.dojoSchedules)
    .set(updateData)
    .where(eq(tables.dojoSchedules.id, Number(scheduleId)))
    .returning() as any[]

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update schedule' })
  }

  return { success: true, schedule: updated }
})
