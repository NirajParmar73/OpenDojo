import { and, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { getHierarchyManagementScope, hasStudentPortalManagementAccess } from './permissions'

export type AnnouncementAudience = { dojoId: number | null, scopeNodeId: number | null }

export async function assertAnnouncementAudienceAccess(user: { id: number, role: string, organizationId?: number | null }, audience: AnnouncementAudience) {
  const organizationId = user.organizationId
  if (!organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (audience.dojoId !== null && audience.scopeNodeId !== null) {
    throw createError({ statusCode: 400, statusMessage: 'Choose either a dojo or a territory audience' })
  }
  if (audience.dojoId === null && audience.scopeNodeId === null) {
    if (!['owner', 'admin'].includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Only organization administrators can publish organization-wide announcements' })
    }
    return
  }
  if (audience.dojoId !== null) {
    const dojo = await db.query.dojos.findFirst({
      where: and(eq(tables.dojos.id, audience.dojoId), eq(tables.dojos.organizationId, organizationId)),
    })
    if (!dojo) throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
    if (!await hasStudentPortalManagementAccess(user.id, organizationId, audience.dojoId)) {
      throw createError({ statusCode: 403, statusMessage: 'You cannot publish announcements for this dojo' })
    }
    return
  }

  const node = await db.query.hierarchyNodes.findFirst({
    where: and(eq(tables.hierarchyNodes.id, audience.scopeNodeId!), eq(tables.hierarchyNodes.organizationId, organizationId)),
  })
  if (!node) throw createError({ statusCode: 404, statusMessage: 'Territory not found' })
  if (!['owner', 'admin'].includes(user.role)) {
    const scope = await getHierarchyManagementScope(user.id, organizationId)
    if (!scope.managedParentNodeIds.includes(node.id)) {
      throw createError({ statusCode: 403, statusMessage: 'You cannot publish announcements for this territory' })
    }
  }
}
