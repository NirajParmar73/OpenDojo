import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getHierarchyManagementScope } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const user = session.user
  const organizationId = user.organizationId as number

  let audience
  if (['owner', 'admin'].includes(user.role)) {
    audience = eq(tables.announcements.organizationId, organizationId)
  } else {
    const scope = await getHierarchyManagementScope(user.id, organizationId)
    if (!scope.managedDojoIds.length) return []
    audience = and(eq(tables.announcements.organizationId, organizationId), inArray(tables.announcements.dojoId, scope.managedDojoIds))
  }

  return db.query.announcements.findMany({
    where: audience,
    with: { dojo: true, creator: { columns: { id: true, name: true } } },
    orderBy: [desc(tables.announcements.publishedAt)],
  })
})
