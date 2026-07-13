import { getAllowedAssignmentsForCreator, getHierarchyManagementScope } from '../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const permissions = await getAllowedAssignmentsForCreator(session.user.id, orgId)
  const scope = await getHierarchyManagementScope(session.user.id, orgId)

  return { ...permissions, managedParentNodeIds: scope.managedParentNodeIds }
})
