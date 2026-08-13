import { and, eq } from 'drizzle-orm'
import { assertAnnouncementAudienceAccess } from '../../utils/announcements'
import { writeAuditLog } from '../../utils/audit'
import { db, tables } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid announcement' })
  const announcement = await db.query.announcements.findFirst({ where: and(eq(tables.announcements.id, id), eq(tables.announcements.organizationId, session.user.organizationId)) })
  if (!announcement) throw createError({ statusCode: 404, statusMessage: 'Announcement not found' })
  await assertAnnouncementAudienceAccess(session.user, announcement.dojoId)
  await db.delete(tables.announcements).where(eq(tables.announcements.id, id))
  await writeAuditLog({
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    action: 'announcement.deleted',
    entityType: 'announcement',
    entityId: id,
    targetLabel: announcement.title,
    scope: announcement.dojoId ? { type: 'dojo', id: announcement.dojoId } : { type: 'organization' },
  })
  return { success: true }
})
