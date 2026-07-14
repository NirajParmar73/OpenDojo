import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { assertDojoManagementAccess } from '../../../../utils/permissions'

const createSessionSchema = z.object({
  date: z.string(), // ISO date string
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  scheduleId: z.number().int().positive().optional().nullable(),
  instructorId: z.number().int().positive().optional().nullable(),
  name: z.string().optional().nullable(),
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

  const body = await readValidatedBody(event, createSessionSchema.parse)

  // If scheduleId provided, verify it belongs to the same dojo
  if (body.scheduleId) {
    const schedule = await db.query.dojoSchedules.findFirst({
      where: and(
        eq(tables.dojoSchedules.id, body.scheduleId),
        eq(tables.dojoSchedules.dojoId, Number(dojoId))
      ),
    })
    if (!schedule) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid schedule' })
    }
  }

  // The dojo roster is the source of truth for who can teach a class here.
  // A person can be an organization admin (or hierarchy head) and still be an
  // assigned instructor for a specific dojo.
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
    const rosterAssignment = await db.query.dojoInstructors.findFirst({
      where: and(
        eq(tables.dojoInstructors.dojoId, Number(dojoId)),
        eq(tables.dojoInstructors.userId, body.instructorId),
        eq(tables.dojoInstructors.isActive, 1)
      ),
    })
    if (!rosterAssignment && instructor.role !== 'owner') {
      throw createError({ statusCode: 400, statusMessage: 'Select an active instructor assigned to this dojo' })
    }
  }

  const [newSession] = await db.insert(tables.classSessions).values({
    dojoId: Number(dojoId),
    date: new Date(body.date),
    startTime: body.startTime,
    endTime: body.endTime,
    scheduleId: body.scheduleId || null,
    instructorId: body.instructorId || null,
    name: body.name || null,
  }).returning() as any[]

  if (!newSession) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create session' })
  }

  // Optionally, we could auto‑create attendance records for all active students of the dojo.
  // But we'll let the frontend handle that when marking attendance.

  return { success: true, session: newSession }
})
