import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { assertSyllabusScopeAccess } from '../../../utils/syllabus'
import { writeAuditLog } from '../../../utils/audit'

const schema = z.object({ scopeType: z.enum(['organization', 'node', 'dojo']), scopeId: z.number().int().positive().nullable() })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const rankId = Number(getRouterParam(event, 'rankId'))
  if (!session?.user?.organizationId || !rankId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const userId = session.user.id
  const body = await readValidatedBody(event, schema.parse)
  await assertSyllabusScopeAccess(userId, organizationId, body.scopeType, body.scopeId)
  const syllabus = await db.query.syllabi.findFirst({ where: and(eq(tables.syllabi.organizationId, organizationId), eq(tables.syllabi.targetBeltRankId, rankId), eq(tables.syllabi.scopeType, body.scopeType), body.scopeId === null ? isNull(tables.syllabi.scopeId) : eq(tables.syllabi.scopeId, body.scopeId)) })
  if (!syllabus) throw createError({ statusCode: 404, statusMessage: 'Save the syllabus before publishing it' })
  const draft = await db.query.syllabusVersions.findFirst({ where: and(eq(tables.syllabusVersions.syllabusId, syllabus.id), eq(tables.syllabusVersions.status, 'draft')) })
  if (!draft) throw createError({ statusCode: 409, statusMessage: 'There is no draft to publish' })
  const sections = await db.query.syllabusSections.findMany({ where: eq(tables.syllabusSections.versionId, draft.id), with: { items: true } })
  if (!sections.some(section => section.items.length)) throw createError({ statusCode: 400, statusMessage: 'Add at least one syllabus item before publishing' })

  let parentVersionId: number | null = null
  if (draft.inheritPrevious) {
    const ranks = await db.query.beltRanks.findMany({ where: eq(tables.beltRanks.systemId, syllabus.beltSystemId), orderBy: (rank, { asc }) => [asc(rank.order)] })
    const index = ranks.findIndex(rank => rank.id === rankId)
    const previousRank = index > 0 ? ranks[index - 1] : null
    if (previousRank) {
      const scopedParent = await db.query.syllabi.findFirst({ where: and(eq(tables.syllabi.organizationId, organizationId), eq(tables.syllabi.targetBeltRankId, previousRank.id), eq(tables.syllabi.scopeType, body.scopeType), body.scopeId === null ? isNull(tables.syllabi.scopeId) : eq(tables.syllabi.scopeId, body.scopeId)) })
      const organizationParent = await db.query.syllabi.findFirst({ where: and(eq(tables.syllabi.organizationId, organizationId), eq(tables.syllabi.targetBeltRankId, previousRank.id), eq(tables.syllabi.scopeType, 'organization'), isNull(tables.syllabi.scopeId)) })
      for (const parent of [scopedParent, organizationParent].filter((item, position, all) => item && all.findIndex(candidate => candidate?.id === item.id) === position)) {
        const published = await db.query.syllabusVersions.findFirst({ where: and(eq(tables.syllabusVersions.syllabusId, parent!.id), eq(tables.syllabusVersions.status, 'published')), orderBy: [desc(tables.syllabusVersions.version)] })
        if (published) { parentVersionId = published.id; break }
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx.update(tables.syllabusVersions).set({ status: 'archived' }).where(and(eq(tables.syllabusVersions.syllabusId, syllabus.id), eq(tables.syllabusVersions.status, 'published')))
    await tx.update(tables.syllabusVersions).set({ status: 'published', parentVersionId, publishedAt: new Date(), publishedBy: userId }).where(eq(tables.syllabusVersions.id, draft.id))
  })
  await writeAuditLog({ organizationId, actorUserId: userId, action: 'syllabus.published', entityType: 'syllabus', entityId: syllabus.id, targetLabel: syllabus.title, scope: body.scopeType === 'organization' ? { type: 'organization' } : { type: body.scopeType, id: body.scopeId! }, details: `Published version ${draft.version}.` })
  return { success: true }
})
