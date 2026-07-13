import { desc, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getHierarchyManagementScope } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const scope = await getHierarchyManagementScope(session.user.id, organizationId)
  const logs = await db.query.auditLogs.findMany({
    where: eq(tables.auditLogs.organizationId, organizationId),
    with: { actor: { columns: { id: true, name: true, email: true } } },
    orderBy: [desc(tables.auditLogs.createdAt)],
    limit: 200,
  })
  if (session.user.role === 'owner') return logs
  return logs.filter(log => (log.scopeType === 'node' && log.scopeId !== null && scope.managedParentNodeIds.includes(log.scopeId)) || (log.scopeType === 'dojo' && log.scopeId !== null && scope.managedDojoIds.includes(log.scopeId)))
})
