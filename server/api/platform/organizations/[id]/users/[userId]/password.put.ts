import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../../../utils/database'
import { writePlatformAuditLog } from '../../../../../../utils/platform-audit'
import { requirePlatformAdmin } from '../../../../../../utils/platform-admin'

const bodySchema = z.object({ password: z.string().min(12).max(256) })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const organizationId = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const userId = z.coerce.number().int().positive().parse(getRouterParam(event, 'userId'))
  const { password } = await readValidatedBody(event, bodySchema.parse)
  const user = await db.query.users.findFirst({ where: and(eq(tables.users.id, userId), eq(tables.users.organizationId, organizationId)) })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId), columns: { name: true } })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  await db.update(tables.users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(tables.users.id, user.id))
  await writePlatformAuditLog({ actorUserId: session.user.id, action: 'organization_user_password_reset', organizationId, organizationName: organization.name, details: `Password reset for ${user.email} by the platform administrator.` })
  return { success: true }
})
