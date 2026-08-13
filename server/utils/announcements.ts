import { and, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { hasStudentPortalManagementAccess } from './permissions'

export async function assertAnnouncementAudienceAccess(user: { id: number, role: string, organizationId?: number | null }, dojoId: number | null) {
  const organizationId = user.organizationId
  if (!organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (dojoId === null) {
    if (!['owner', 'admin'].includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Only organization administrators can publish organization-wide announcements' })
    }
    return
  }
  const dojo = await db.query.dojos.findFirst({
    where: and(eq(tables.dojos.id, dojoId), eq(tables.dojos.organizationId, organizationId)),
  })
  if (!dojo) throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  if (!await hasStudentPortalManagementAccess(user.id, organizationId, dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot publish announcements for this dojo' })
  }
}

