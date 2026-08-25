import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { assertSyllabusScopeAccess, getVersionSections, type SyllabusScope } from '../../utils/syllabus'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const rankId = Number(getRouterParam(event, 'rankId'))
  if (!session?.user?.organizationId || !rankId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const query = getQuery(event)
  const scopeType = String(query.scopeType || 'organization') as SyllabusScope['scopeType']
  const scopeId = query.scopeId ? Number(query.scopeId) : null
  await assertSyllabusScopeAccess(session.user.id, session.user.organizationId, scopeType, scopeId)
  const syllabus = await db.query.syllabi.findFirst({
    where: and(
      eq(tables.syllabi.organizationId, session.user.organizationId),
      eq(tables.syllabi.targetBeltRankId, rankId),
      eq(tables.syllabi.scopeType, scopeType),
      scopeId === null ? isNull(tables.syllabi.scopeId) : eq(tables.syllabi.scopeId, scopeId),
    ),
  })
  if (!syllabus) return { syllabus: null, version: null, sections: [] }
  const versions = await db.query.syllabusVersions.findMany({ where: eq(tables.syllabusVersions.syllabusId, syllabus.id), orderBy: [desc(tables.syllabusVersions.version)] })
  const version = versions.find(item => item.status === 'draft') || versions.find(item => item.status === 'published') || null
  return { syllabus, version, sections: version ? (await getVersionSections(version.id)).filter(section => section.versionId === version.id) : [], versions: versions.map(item => ({ id: item.id, version: item.version, status: item.status, publishedAt: item.publishedAt })) }
})
