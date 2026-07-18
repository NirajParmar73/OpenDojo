import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'
import { subscriptionPlans } from '../../../utils/subscription'
import { requirePlatformAdmin } from '../../../utils/platform-admin'
import { organizationSlug, reservedSubdomains } from '../../../utils/tenant'

const bodySchema = z.object({
  subscriptionPlan: z.enum(subscriptionPlans).optional(),
  slug: z.string().min(1).max(80).optional(),
}).refine(body => body.subscriptionPlan !== undefined || body.slug !== undefined, { message: 'Provide a plan or workspace slug' })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const id = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const existing = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, id) })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })

  let slug = existing.slug
  if (body.slug !== undefined) {
    slug = organizationSlug(body.slug)
    if (!slug || reservedSubdomains.has(slug)) throw createError({ statusCode: 400, statusMessage: 'Choose a different workspace address' })
    const conflict = await db.query.organizations.findFirst({ where: eq(tables.organizations.slug, slug), columns: { id: true } })
    if (conflict && conflict.id !== id) throw createError({ statusCode: 409, statusMessage: 'That workspace address is already taken' })
  }

  const [organization] = await db.update(tables.organizations)
    .set({
      subscriptionPlan: body.subscriptionPlan ?? existing.subscriptionPlan,
      subscriptionStatus: body.subscriptionPlan === undefined ? existing.subscriptionStatus : body.subscriptionPlan === 'free' ? 'free' : 'active',
      billingPeriod: body.subscriptionPlan === 'free' ? null : existing.billingPeriod,
      subscriptionStartedAt: body.subscriptionPlan && body.subscriptionPlan !== 'free' ? existing.subscriptionStartedAt || new Date() : existing.subscriptionStartedAt,
      subscriptionEndsAt: body.subscriptionPlan === 'free' ? null : existing.subscriptionEndsAt,
      cancelAtPeriodEnd: body.subscriptionPlan === 'free' ? false : existing.cancelAtPeriodEnd,
      slug,
      updatedAt: new Date(),
    })
    .where(eq(tables.organizations.id, id))
    .returning({ id: tables.organizations.id, name: tables.organizations.name, slug: tables.organizations.slug, subscriptionPlan: tables.organizations.subscriptionPlan })

  await writeAuditLog({
    organizationId: organization.id,
    actorUserId: session.user.id,
    action: body.slug !== undefined ? 'platform_workspace_slug_updated' : 'platform_subscription_updated',
    entityType: 'organization',
    entityId: organization.id,
    targetLabel: organization.name,
    // Keep the entry visible to the workspace owner in their existing audit log.
    scope: { type: 'organization' },
    details: body.slug !== undefined ? `Workspace address changed from ${existing.slug} to ${organization.slug} by the platform administrator.` : `Subscription plan changed to ${organization.subscriptionPlan} by the platform administrator.`,
  })

  return organization
})
