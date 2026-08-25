import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { assertSyllabusScopeAccess } from '../../utils/syllabus'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({
  scopeType: z.enum(['organization', 'node', 'dojo']),
  scopeId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(160),
  inheritPrevious: z.boolean().default(true),
  sections: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional().nullable(),
    items: z.array(z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).optional().nullable(), required: z.boolean().default(true) })).max(200),
  })).max(50),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const rankId = Number(getRouterParam(event, 'rankId'))
  if (!session?.user?.organizationId || !rankId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const userId = session.user.id
  const body = await readValidatedBody(event, schema.parse)
  if (body.scopeType === 'organization' && body.scopeId !== null) throw createError({ statusCode: 400, statusMessage: 'Organization scope cannot have a scope ID' })
  if (body.scopeType !== 'organization' && body.scopeId === null) throw createError({ statusCode: 400, statusMessage: 'Select a territory or dojo scope' })
  await assertSyllabusScopeAccess(userId, organizationId, body.scopeType, body.scopeId)
  const rank = await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, rankId), with: { system: true } })
  if (!rank || rank.system.organizationId !== organizationId) throw createError({ statusCode: 404, statusMessage: 'Belt rank not found' })

  const result = await db.transaction(async (tx) => {
    let syllabus = await tx.query.syllabi.findFirst({
      where: and(eq(tables.syllabi.organizationId, organizationId), eq(tables.syllabi.targetBeltRankId, rankId), eq(tables.syllabi.scopeType, body.scopeType), body.scopeId === null ? isNull(tables.syllabi.scopeId) : eq(tables.syllabi.scopeId, body.scopeId)),
    })
    if (!syllabus) {
      [syllabus] = await tx.insert(tables.syllabi).values({ organizationId, beltSystemId: rank.systemId, targetBeltRankId: rankId, scopeType: body.scopeType, scopeId: body.scopeId, title: body.title, createdBy: userId }).returning()
    } else await tx.update(tables.syllabi).set({ title: body.title }).where(eq(tables.syllabi.id, syllabus.id))
    if (!syllabus) throw createError({ statusCode: 500, statusMessage: 'Could not create syllabus' })

    let draft = await tx.query.syllabusVersions.findFirst({ where: and(eq(tables.syllabusVersions.syllabusId, syllabus.id), eq(tables.syllabusVersions.status, 'draft')) })
    if (draft) {
      await tx.delete(tables.syllabusSections).where(eq(tables.syllabusSections.versionId, draft.id))
      await tx.update(tables.syllabusVersions).set({ inheritPrevious: body.inheritPrevious }).where(eq(tables.syllabusVersions.id, draft.id))
    } else {
      const latest = await tx.query.syllabusVersions.findFirst({ where: eq(tables.syllabusVersions.syllabusId, syllabus.id), orderBy: [desc(tables.syllabusVersions.version)] })
      ;[draft] = await tx.insert(tables.syllabusVersions).values({ syllabusId: syllabus.id, version: (latest?.version || 0) + 1, inheritPrevious: body.inheritPrevious }).returning()
    }
    if (!draft) throw createError({ statusCode: 500, statusMessage: 'Could not save syllabus draft' })
    for (const [sectionIndex, section] of body.sections.entries()) {
      const [createdSection] = await tx.insert(tables.syllabusSections).values({ versionId: draft.id, name: section.name, description: section.description || null, order: sectionIndex + 1 }).returning()
      if (!createdSection) continue
      if (section.items.length) await tx.insert(tables.syllabusItems).values(section.items.map((item, itemIndex) => ({ sectionId: createdSection.id, name: item.name, description: item.description || null, required: item.required, order: itemIndex + 1 })))
    }
    return { success: true, versionId: draft.id, syllabusId: syllabus.id }
  })
  await writeAuditLog({ organizationId, actorUserId: userId, action: 'syllabus.draft_saved', entityType: 'syllabus', entityId: result.syllabusId, targetLabel: body.title, scope: body.scopeType === 'organization' ? { type: 'organization' } : { type: body.scopeType, id: body.scopeId! } })
  return result
})
