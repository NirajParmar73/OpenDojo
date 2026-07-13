import { eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { writeAuditLog } from '../../../utils/audit'

const commonLevels = ['State / Province', 'District', 'City / Town']

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Only the organization owner can add hierarchy levels.' })

  const organizationId = session.user.organizationId
  const levels = await db.query.hierarchyLevels.findMany({
    where: eq(tables.hierarchyLevels.organizationId, organizationId),
    orderBy: (level, { asc }) => [asc(level.order)]
  })
  const existingNames = new Set(levels.map(level => level.name.trim().toLowerCase()))
  const missing = commonLevels.filter(name => !existingNames.has(name.toLowerCase()))

  if (!missing.length) return { success: true, created: 0 }

  await db.insert(tables.hierarchyLevels).values(missing.map((name, index) => ({
    organizationId,
    name,
    order: levels.length + index + 1
  })))

  await writeAuditLog({
    organizationId,
    actorUserId: session.user.id,
    action: 'hierarchy_levels.common_added',
    entityType: 'organization',
    entityId: organizationId,
    targetLabel: 'Common hierarchy levels',
    scope: { type: 'organization' },
    details: `Added: ${missing.join(', ')}`
  })

  return { success: true, created: missing.length }
})
