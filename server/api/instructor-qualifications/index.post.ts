import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { writeAuditLog } from '../../utils/audit'
import { db, tables } from '../../utils/database'
import { getAccessibleDojoIds } from '../../utils/permissions'

const schema = z.object({ userId: z.number().int().positive(), programId: z.number().int().positive().nullable(), qualification: z.string().min(1).max(255), issuer: z.string().max(255).optional(), expiresAt: z.string().date().optional() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const organizationId = session.user.organizationId
  const instructor = await db.query.users.findFirst({
    where: and(eq(tables.users.id, body.userId), eq(tables.users.organizationId, organizationId)),
    columns: { id: true, name: true }
  })
  if (!instructor) throw createError({ statusCode: 404, statusMessage: 'Instructor not found in this organization' })

  if (body.programId) {
    const program = await db.query.organizationPrograms.findFirst({
      where: and(eq(tables.organizationPrograms.id, body.programId), eq(tables.organizationPrograms.organizationId, organizationId)),
      columns: { id: true }
    })
    if (!program) throw createError({ statusCode: 400, statusMessage: 'Invalid program' })
  }

  if (session.user.role !== 'owner' && session.user.id !== instructor.id) {
    const [managerDojos, instructorDojos] = await Promise.all([
      getAccessibleDojoIds(session.user.id, organizationId),
      getAccessibleDojoIds(instructor.id, organizationId)
    ])
    const managesInstructor = managerDojos === null || instructorDojos === null || instructorDojos.some(dojoId => managerDojos.includes(dojoId))
    if (!managesInstructor) throw createError({ statusCode: 403, statusMessage: 'This instructor is outside your assigned territory' })
  }

  const [qualification] = await db.insert(tables.instructorQualifications).values({ organizationId, ...body, issuer: body.issuer || null, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }).returning()
  await writeAuditLog({ organizationId, actorUserId: session.user.id, action: 'instructor_qualification.created', entityType: 'instructor_qualification', entityId: qualification?.id, targetLabel: instructor.name, scope: { type: 'organization' }, details: body.qualification })
  return { success: true, qualification }
})
