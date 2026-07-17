import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { writePlatformAuditLog } from '../../../../utils/platform-audit'
import { requirePlatformAdmin } from '../../../../utils/platform-admin'

const bodySchema = z.object({ newOwnerUserId: z.number().int().positive() })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const organizationId = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const { newOwnerUserId } = await readValidatedBody(event, bodySchema.parse)
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId) })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  const newOwner = await db.query.users.findFirst({ where: and(eq(tables.users.id, newOwnerUserId), eq(tables.users.organizationId, organizationId)) })
  if (!newOwner) throw createError({ statusCode: 400, statusMessage: 'The selected account does not belong to this organization' })
  const currentOwner = await db.query.users.findFirst({ where: and(eq(tables.users.organizationId, organizationId), eq(tables.users.role, 'owner')) })

  await db.transaction(async (tx) => {
    if (currentOwner && currentOwner.id !== newOwner.id) {
      await tx.update(tables.users).set({ role: 'admin', updatedAt: new Date() }).where(eq(tables.users.id, currentOwner.id))
    }
    await tx.update(tables.users).set({ role: 'owner', updatedAt: new Date() }).where(eq(tables.users.id, newOwner.id))
  })
  await writePlatformAuditLog({
    actorUserId: session.user.id,
    action: 'organization_owner_reassigned',
    organizationId,
    organizationName: organization.name,
    details: `${newOwner.email} was assigned as organization owner${currentOwner ? `; ${currentOwner.email} was changed to administrator` : ''}.`,
  })
  return { success: true, owner: { id: newOwner.id, name: newOwner.name, email: newOwner.email } }
})
