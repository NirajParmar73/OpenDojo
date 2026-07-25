import { and, count, eq } from 'drizzle-orm'
import { db, tables } from './database'

// Plans are intentionally based on business scale, never on geography.  The
// legacy values remain recognised below so existing subscriptions keep working.
export const subscriptionPlans = ['free', 'growth', 'business'] as const
export type SubscriptionPlan = typeof subscriptionPlans[number]
export const billingPeriods = ['monthly', 'annual'] as const
export type BillingPeriod = typeof billingPeriods[number]
export const subscriptionStatuses = ['free', 'pending_payment', 'trialing', 'active', 'cancelled', 'expired', 'suspended'] as const
export type SubscriptionStatus = typeof subscriptionStatuses[number]

const planLimits: Record<SubscriptionPlan, { students: number | null, studentsPerDojo: number | null, dojos: number | null, instructorsPerDojo: number | null }> = {
  free: { students: 20, studentsPerDojo: null, dojos: 1, instructorsPerDojo: 1 },
  growth: { students: 150, studentsPerDojo: null, dojos: 3, instructorsPerDojo: null },
  business: { students: null, studentsPerDojo: null, dojos: null, instructorsPerDojo: null },
}

const legacyPlanMap: Record<string, SubscriptionPlan> = {
  'city-starter': 'growth', 'city-pro': 'growth', 'state-pro': 'business', national: 'business',
}

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  if (subscriptionPlans.includes(plan as SubscriptionPlan)) return plan as SubscriptionPlan
  return legacyPlanMap[plan || ''] || 'free'
}

export function planLabel(plan: SubscriptionPlan) { return ({ free: 'Free', growth: 'Growth', business: 'Business' } as const)[plan] }

export async function getSubscription(orgId: number) {
  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, orgId),
    columns: { subscriptionPlan: true, subscriptionStatus: true, billingPeriod: true, trialStartedAt: true, trialEndsAt: true, subscriptionStartedAt: true, subscriptionEndsAt: true, cancelAtPeriodEnd: true, paymentProvider: true, providerCustomerId: true, providerSubscriptionId: true },
  })
  const now = new Date()
  const trialExpired = organization?.subscriptionStatus === 'trialing' && organization.trialEndsAt && organization.trialEndsAt <= now
  const paidTermExpired = normalizePlan(organization?.subscriptionPlan) !== 'free' && organization?.subscriptionEndsAt && organization.subscriptionEndsAt <= now
  if (trialExpired || paidTermExpired) {
    await db.update(tables.organizations).set({ subscriptionPlan: 'free', subscriptionStatus: 'expired', billingPeriod: null, updatedAt: new Date() }).where(eq(tables.organizations.id, orgId))
    return { plan: 'free' as const, limits: planLimits.free, status: 'expired' as const, billingPeriod: null, trialStartedAt: organization?.trialStartedAt || null, trialEndsAt: organization?.trialEndsAt || null, subscriptionStartedAt: null, subscriptionEndsAt: null, cancelAtPeriodEnd: false, paymentProvider: null, providerCustomerId: null, providerSubscriptionId: null }
  }
  const plan = organization?.subscriptionStatus === 'pending_payment' ? 'free' : normalizePlan(organization?.subscriptionPlan)
  return { plan, limits: planLimits[plan], status: subscriptionStatuses.includes(organization?.subscriptionStatus as SubscriptionStatus) ? organization!.subscriptionStatus as SubscriptionStatus : plan === 'free' ? 'free' : 'active', billingPeriod: organization?.billingPeriod === 'monthly' || organization?.billingPeriod === 'annual' ? organization.billingPeriod : null, trialStartedAt: organization?.trialStartedAt || null, trialEndsAt: organization?.trialEndsAt || null, subscriptionStartedAt: organization?.subscriptionStartedAt || null, subscriptionEndsAt: organization?.subscriptionEndsAt || null, cancelAtPeriodEnd: organization?.cancelAtPeriodEnd || false, paymentProvider: organization?.paymentProvider || null, providerCustomerId: organization?.providerCustomerId || null, providerSubscriptionId: organization?.providerSubscriptionId || null }
}

export async function startSubscriptionTrial(orgId: number, plan: Exclude<SubscriptionPlan, 'free'>, billingPeriod: BillingPeriod) {
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, orgId), columns: { trialStartedAt: true, subscriptionPlan: true, subscriptionStatus: true } })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  if (organization.trialStartedAt) throw createError({ statusCode: 409, statusMessage: 'This organization has already used its free trial.' })
  if (normalizePlan(organization.subscriptionPlan) !== 'free' || ['trialing', 'active', 'suspended'].includes(organization.subscriptionStatus)) throw createError({ statusCode: 409, statusMessage: 'This organization already has paid-plan access.' })
  const trialStartedAt = new Date(); const trialEndsAt = new Date(trialStartedAt); trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  await db.update(tables.organizations).set({ subscriptionPlan: plan, subscriptionStatus: 'trialing', billingPeriod, trialStartedAt, trialEndsAt, subscriptionStartedAt: null, subscriptionEndsAt: null, cancelAtPeriodEnd: false, updatedAt: trialStartedAt }).where(eq(tables.organizations.id, orgId))
  return { plan, billingPeriod, trialStartedAt, trialEndsAt }
}

async function getStudentCount(orgId: number) { const [result] = await db.select({ value: count() }).from(tables.students).where(eq(tables.students.organizationId, orgId)); return result?.value ?? 0 }
async function getDojoCount(orgId: number) { const [result] = await db.select({ value: count() }).from(tables.dojos).where(eq(tables.dojos.organizationId, orgId)); return result?.value ?? 0 }
async function getInstructorCount(dojoId: number) { const [result] = await db.select({ value: count() }).from(tables.dojoInstructors).where(eq(tables.dojoInstructors.dojoId, dojoId)); return result?.value ?? 0 }
async function getHierarchyNodeCount(orgId: number) { const [result] = await db.select({ value: count() }).from(tables.hierarchyNodes).where(eq(tables.hierarchyNodes.organizationId, orgId)); return result?.value ?? 0 }

export async function assertStudentLimit(orgId: number) { const { plan, limits } = await getSubscription(orgId); if (limits.students !== null && await getStudentCount(orgId) >= limits.students) throw createError({ statusCode: 402, statusMessage: `${planLabel(plan)} plan limit reached: upgrade to enrol more than ${limits.students} students.` }) }
export async function assertDojoLimit(orgId: number) { const { plan, limits } = await getSubscription(orgId); if (limits.dojos !== null && await getDojoCount(orgId) >= limits.dojos) throw createError({ statusCode: 402, statusMessage: `${planLabel(plan)} plan limit reached: upgrade to add more locations.` }) }
// Kept as a compatibility no-op for callers. Locations may be in any geography.
export async function assertDojoTerritory(_orgId: number, _location: Record<string, unknown>) {}
export async function assertStaffAccountLimit(orgId: number) { const { limits } = await getSubscription(orgId); if (limits.instructorsPerDojo === null) return; const [result] = await db.select({ value: count() }).from(tables.users).where(eq(tables.users.organizationId, orgId)); if ((result?.value || 0) >= 1) throw createError({ statusCode: 402, statusMessage: 'Free includes one owner account. Upgrade to add staff.' }) }
export async function assertInstructorLimit(orgId: number, dojoId: number) { const { limits } = await getSubscription(orgId); if (limits.instructorsPerDojo !== null && await getInstructorCount(dojoId) >= limits.instructorsPerDojo) throw createError({ statusCode: 402, statusMessage: 'Free includes one owner/instructor. Upgrade to add staff.' }) }
export async function assertFederationManagementAccess(_orgId: number) {}
export async function assertHierarchyLevelAllowed(_orgId: number, _levelName: string) {}
export async function getAllowedHierarchyLevelNames(_orgId: number) { return null }
export async function getSubscriptionUsage(orgId: number) { const [{ plan, limits }, students, dojos, hierarchyNodes] = await Promise.all([getSubscription(orgId), getStudentCount(orgId), getDojoCount(orgId), getHierarchyNodeCount(orgId)]); return { plan, limits, usage: { students, dojos, hierarchyNodes } } }
