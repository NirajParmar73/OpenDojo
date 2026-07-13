import { db, tables } from '../../../utils/database'
import { eq } from 'drizzle-orm'
import { getAccessibleDojoIds, getHierarchyManagementScope } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const expenses = await db.query.expenses.findMany({
    where: eq(tables.expenses.organizationId, session.user.organizationId),
    with: { affiliation: { with: { governingBody: true } } },
    orderBy: (expenses, { desc }) => [desc(expenses.incurredAt)]
  })
  if (session.user.role === 'owner') return expenses
  const [dojoIds, scope] = await Promise.all([
    getAccessibleDojoIds(session.user.id, session.user.organizationId),
    getHierarchyManagementScope(session.user.id, session.user.organizationId)
  ])
  return expenses.filter(expense => (
    expense.scopeType === 'node'
      ? scope.managedParentNodeIds.includes(expense.scopeId!)
      : expense.scopeType === 'dojo'
        ? dojoIds?.includes(expense.scopeId!)
        : false
  ))
})
