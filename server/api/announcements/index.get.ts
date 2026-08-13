import { and, desc, eq, inArray, or } from 'drizzle-orm'
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
    if (!scope.managedDojoIds.length && !scope.managedParentNodeIds.length) return []
    audience = and(
      eq(tables.announcements.organizationId, organizationId),
      or(
        ...(scope.managedDojoIds.length ? [inArray(tables.announcements.dojoId, scope.managedDojoIds)] : []),
        ...(scope.managedParentNodeIds.length ? [inArray(tables.announcements.scopeNodeId, scope.managedParentNodeIds)] : []),
      ),
    )
  }

  return db.query.announcements.findMany({
    where: audience,
    with: { dojo: true, scopeNode: true, creator: { columns: { id: true, name: true } } },
    orderBy: [desc(tables.announcements.publishedAt)],
  })
})
