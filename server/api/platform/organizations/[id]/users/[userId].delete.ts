import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../../utils/database'
import { writePlatformAuditLog } from '../../../../../utils/platform-audit'
import { requirePlatformAdmin } from '../../../../../utils/platform-admin'

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const organizationId = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const userId = z.coerce.number().int().positive().parse(getRouterParam(event, 'userId'))
  const user = await db.query.users.findFirst({ where: and(eq(tables.users.id, userId), eq(tables.users.organizationId, organizationId)) })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  if (user.role === 'owner') throw createError({ statusCode: 409, statusMessage: 'Reassign the organization owner before deleting this account' })
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId), columns: { name: true } })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  await db.delete(tables.users).where(eq(tables.users.id, user.id))
  await writePlatformAuditLog({ actorUserId: session.user.id, action: 'organization_user_deleted', organizationId, organizationName: organization.name, details: `${user.email} was permanently deleted by the platform administrator.` })
  return { success: true }
})
