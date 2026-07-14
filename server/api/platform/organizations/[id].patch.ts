import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'
import { subscriptionPlans } from '../../../utils/subscription'
import { requirePlatformAdmin } from '../../../utils/platform-admin'

const bodySchema = z.object({ subscriptionPlan: z.enum(subscriptionPlans) })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const id = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const [organization] = await db.update(tables.organizations)
    .set({ subscriptionPlan: body.subscriptionPlan, updatedAt: new Date() })
    .where(eq(tables.organizations.id, id))
    .returning({ id: tables.organizations.id, name: tables.organizations.name, subscriptionPlan: tables.organizations.subscriptionPlan })

  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  await writeAuditLog({
    organizationId: organization.id,
    actorUserId: session.user.id,
    action: 'platform_subscription_updated',
    entityType: 'organization',
    entityId: organization.id,
    targetLabel: organization.name,
    // Keep the entry visible to the workspace owner in their existing audit log.
    scope: { type: 'organization' },
    details: `Subscription plan changed to ${organization.subscriptionPlan} by the platform administrator.`,
  })

  return organization
})
