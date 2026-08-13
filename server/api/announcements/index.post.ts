import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { assertAnnouncementAudienceAccess } from '../../utils/announcements'
import { writeAuditLog } from '../../utils/audit'

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  message: z.string().trim().min(2).max(5000),
  severity: z.enum(['info', 'success', 'warning', 'urgent']).default('info'),
  dojoId: z.number().int().positive().nullable().default(null),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  await assertAnnouncementAudienceAccess(session.user, body.dojoId)
  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date()
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (expiresAt && expiresAt <= publishedAt) throw createError({ statusCode: 400, statusMessage: 'Expiry must be after publication' })

  const [announcement] = await db.insert(tables.announcements).values({
    organizationId: session.user.organizationId,
    dojoId: body.dojoId,
    title: body.title,
    message: body.message,
    severity: body.severity,
    publishedAt,
    expiresAt,
    createdBy: session.user.id,
  }).returning()
  if (!announcement) throw createError({ statusCode: 500, statusMessage: 'Could not publish announcement' })

  await writeAuditLog({
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    action: 'announcement.published',
    entityType: 'announcement',
    entityId: announcement.id,
    targetLabel: announcement.title,
    scope: announcement.dojoId ? { type: 'dojo', id: announcement.dojoId } : { type: 'organization' },
  })
  return announcement
})

