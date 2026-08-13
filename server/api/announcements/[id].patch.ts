import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { assertAnnouncementAudienceAccess } from '../../utils/announcements'
import { writeAuditLog } from '../../utils/audit'
import { db, tables } from '../../utils/database'

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(5000),
  severity: z.enum(['info', 'success', 'warning', 'urgent']),
  dojoId: z.number().int().positive().nullable(),
  scopeNodeId: z.number().int().positive().nullable(),
  publishedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid announcement' })
  const existing = await db.query.announcements.findFirst({ where: and(eq(tables.announcements.id, id), eq(tables.announcements.organizationId, session.user.organizationId)) })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Announcement not found' })
  await assertAnnouncementAudienceAccess(session.user, { dojoId: existing.dojoId, scopeNodeId: existing.scopeNodeId })

  const body = await readValidatedBody(event, schema.parse)
  await assertAnnouncementAudienceAccess(session.user, { dojoId: body.dojoId, scopeNodeId: body.scopeNodeId })
  const publishedAt = new Date(body.publishedAt)
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (expiresAt && expiresAt <= publishedAt) throw createError({ statusCode: 400, statusMessage: 'Expiry must be after publication' })

  const [announcement] = await db.update(tables.announcements).set({
    title: body.title,
    message: body.message,
    severity: body.severity,
    dojoId: body.dojoId,
    scopeNodeId: body.scopeNodeId,
    publishedAt,
    expiresAt,
    updatedAt: new Date(),
  }).where(eq(tables.announcements.id, id)).returning()
  await writeAuditLog({
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    action: 'announcement.updated',
    entityType: 'announcement',
    entityId: id,
    targetLabel: announcement!.title,
    scope: announcement!.dojoId ? { type: 'dojo', id: announcement!.dojoId } : announcement!.scopeNodeId ? { type: 'node', id: announcement!.scopeNodeId } : { type: 'organization' },
  })
  return announcement
})
