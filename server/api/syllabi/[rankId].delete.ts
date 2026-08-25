import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { assertSyllabusScopeAccess } from '../../utils/syllabus'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({ scopeType: z.enum(['organization', 'node', 'dojo']), scopeId: z.number().int().positive().nullable() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const rankId = Number(getRouterParam(event, 'rankId'))
  if (!session?.user?.organizationId || !rankId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  await assertSyllabusScopeAccess(session.user.id, session.user.organizationId, body.scopeType, body.scopeId)
  const syllabus = await db.query.syllabi.findFirst({ where: and(eq(tables.syllabi.organizationId, session.user.organizationId), eq(tables.syllabi.targetBeltRankId, rankId), eq(tables.syllabi.scopeType, body.scopeType), body.scopeId === null ? isNull(tables.syllabi.scopeId) : eq(tables.syllabi.scopeId, body.scopeId)) })
  if (!syllabus) return { success: true }
  const versions = await db.query.syllabusVersions.findMany({ where: eq(tables.syllabusVersions.syllabusId, syllabus.id) })
  const versionIds = versions.map(version => version.id)
  const used = versionIds.length ? await db.query.studentSyllabusAssignments.findFirst({ where: inArray(tables.studentSyllabusAssignments.versionId, versionIds) }) : null
  if (used || versions.some(version => version.status !== 'draft')) {
    await db.update(tables.syllabusVersions).set({ status: 'archived' }).where(eq(tables.syllabusVersions.syllabusId, syllabus.id))
    await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'syllabus.archived', entityType: 'syllabus', entityId: syllabus.id, targetLabel: syllabus.title, scope: body.scopeType === 'organization' ? { type: 'organization' } : { type: body.scopeType, id: body.scopeId! } })
    return { success: true, archived: true }
  }
  await db.delete(tables.syllabi).where(eq(tables.syllabi.id, syllabus.id))
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'syllabus.draft_deleted', entityType: 'syllabus', entityId: syllabus.id, targetLabel: syllabus.title, scope: body.scopeType === 'organization' ? { type: 'organization' } : { type: body.scopeType, id: body.scopeId! } })
  return { success: true, archived: false }
})
