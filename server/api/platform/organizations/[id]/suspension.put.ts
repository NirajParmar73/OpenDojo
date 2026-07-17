import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { writePlatformAuditLog } from '../../../../utils/platform-audit'
import { requirePlatformAdmin } from '../../../../utils/platform-admin'

const bodySchema = z.object({ suspended: z.boolean() })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const id = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const { suspended } = await readValidatedBody(event, bodySchema.parse)
  const [organization] = await db.update(tables.organizations)
    .set({ subscriptionStatus: suspended ? 'suspended' : 'free', updatedAt: new Date() })
    .where(eq(tables.organizations.id, id))
    .returning({ id: tables.organizations.id, name: tables.organizations.name, subscriptionStatus: tables.organizations.subscriptionStatus })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  await writePlatformAuditLog({
    actorUserId: session.user.id,
    action: suspended ? 'organization_suspended' : 'organization_reactivated',
    organizationId: organization.id,
    organizationName: organization.name,
    details: suspended ? 'Workspace access was suspended by the platform administrator.' : 'Workspace access was restored on the Free plan by the platform administrator.',
  })
  return organization
})
