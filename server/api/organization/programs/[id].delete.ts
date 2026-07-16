import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid program' })
  const program = await db.query.organizationPrograms.findFirst({ where: and(eq(tables.organizationPrograms.id, id), eq(tables.organizationPrograms.organizationId, session.user.organizationId)) })
  if (!program) throw createError({ statusCode: 404, statusMessage: 'Program not found' })

  const references = await Promise.all([
    db.query.beltSystems.findFirst({ where: eq(tables.beltSystems.programId, id) }),
    db.query.dojoSchedules.findFirst({ where: eq(tables.dojoSchedules.programId, id) }),
    db.query.classSessions.findFirst({ where: eq(tables.classSessions.programId, id) }),
    db.query.instructorQualifications.findFirst({ where: eq(tables.instructorQualifications.programId, id) }),
    db.query.dojoInstructors.findFirst({ where: eq(tables.dojoInstructors.programId, id) })
  ])
  if (references.some(Boolean)) throw createError({ statusCode: 409, statusMessage: 'This program is in use and cannot be deleted' })

  await db.delete(tables.organizationPrograms).where(eq(tables.organizationPrograms.id, id))
  return { success: true }
})
