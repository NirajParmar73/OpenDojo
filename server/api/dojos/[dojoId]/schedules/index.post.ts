import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

const createSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  name: z.string().min(1),
  instructorId: z.number().int().positive().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dojoId = getRouterParam(event, 'dojoId')
  if (!dojoId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dojo ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const dojo = await db.query.dojos.findFirst({
    where: and(
      eq(tables.dojos.id, Number(dojoId)),
      eq(tables.dojos.organizationId, orgId)
    ),
  })
  if (!dojo) {
    throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  }

  const body = await readValidatedBody(event, createSchema.parse)

  // If instructorId provided, verify it belongs to the organization and has instructor role
  if (body.instructorId) {
    const instructor = await db.query.users.findFirst({
      where: and(
        eq(tables.users.id, body.instructorId),
        eq(tables.users.organizationId, orgId)
      ),
    })
    if (!instructor) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid instructor' })
    }
    // Optionally check role: instructor or higher
    if (!['owner', 'admin', 'instructor'].includes(instructor.role)) {
      throw createError({ statusCode: 400, statusMessage: 'User is not an instructor' })
    }
  }

  const [schedule] = await db.insert(tables.dojoSchedules).values({
    dojoId: Number(dojoId),
    dayOfWeek: body.dayOfWeek,
    startTime: body.startTime,
    endTime: body.endTime,
    name: body.name,
    instructorId: body.instructorId || null,
  }).returning() as any[]

  if (!schedule) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create schedule' })
  }

  return { success: true, schedule }
})