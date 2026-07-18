import { and, count, eq } from 'drizzle-orm'
import { db, tables } from './database'

export const subscriptionPlans = ['free', 'city-starter', 'city-pro', 'state-pro', 'national'] as const
export type SubscriptionPlan = typeof subscriptionPlans[number]
export const billingPeriods = ['monthly', 'annual'] as const
export type BillingPeriod = typeof billingPeriods[number]
export const subscriptionStatuses = ['free', 'trialing', 'active', 'cancelled', 'expired', 'suspended'] as const
export type SubscriptionStatus = typeof subscriptionStatuses[number]

const planLimits: Record<SubscriptionPlan, { students: number | null, studentsPerDojo: number | null, dojos: number | null, instructorsPerDojo: number | null }> = {
  free: { students: 25, studentsPerDojo: null, dojos: 1, instructorsPerDojo: 1 },
  'city-starter': { students: null, studentsPerDojo: 75, dojos: 2, instructorsPerDojo: null },
  'city-pro': { students: null, studentsPerDojo: null, dojos: null, instructorsPerDojo: null },
  'state-pro': { students: null, studentsPerDojo: null, dojos: null, instructorsPerDojo: null },
  national: { students: null, studentsPerDojo: null, dojos: null, instructorsPerDojo: null },
}

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  return subscriptionPlans.includes(plan as SubscriptionPlan) ? plan as SubscriptionPlan : 'free'
}

export async function getSubscription(orgId: number) {
  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, orgId),
    columns: { subscriptionPlan: true, subscriptionStatus: true, billingPeriod: true, trialStartedAt: true, trialEndsAt: true, subscriptionStartedAt: true, subscriptionEndsAt: true, cancelAtPeriodEnd: true, paymentProvider: true, providerCustomerId: true, providerSubscriptionId: true },
  })
  const now = new Date()
  const trialExpired = organization?.subscriptionStatus === 'trialing' && organization.trialEndsAt && organization.trialEndsAt <= now
  const paidTermExpired = organization?.subscriptionPlan !== 'free' && organization?.subscriptionEndsAt && organization.subscriptionEndsAt <= now
  if (trialExpired || paidTermExpired) {
    await db.update(tables.organizations).set({ subscriptionPlan: 'free', subscriptionStatus: 'expired', billingPeriod: null, updatedAt: new Date() }).where(eq(tables.organizations.id, orgId))
    return { plan: 'free' as const, limits: planLimits.free, status: 'expired' as const, billingPeriod: null, trialStartedAt: organization.trialStartedAt, trialEndsAt: organization.trialEndsAt, subscriptionStartedAt: null, subscriptionEndsAt: null, cancelAtPeriodEnd: false, paymentProvider: null, providerCustomerId: null, providerSubscriptionId: null }
  }
  const plan = normalizePlan(organization?.subscriptionPlan)
  return {
    plan,
    limits: planLimits[plan],
    status: subscriptionStatuses.includes(organization?.subscriptionStatus as SubscriptionStatus) ? organization!.subscriptionStatus as SubscriptionStatus : plan === 'free' ? 'free' : 'active',
    billingPeriod: organization?.billingPeriod === 'monthly' || organization?.billingPeriod === 'annual' ? organization.billingPeriod : null,
    trialStartedAt: organization?.trialStartedAt || null,
    trialEndsAt: organization?.trialEndsAt || null,
    subscriptionStartedAt: organization?.subscriptionStartedAt || null,
    subscriptionEndsAt: organization?.subscriptionEndsAt || null,
    cancelAtPeriodEnd: organization?.cancelAtPeriodEnd || false,
    paymentProvider: organization?.paymentProvider || null,
    providerCustomerId: organization?.providerCustomerId || null,
    providerSubscriptionId: organization?.providerSubscriptionId || null,
  }
}

export async function startSubscriptionTrial(orgId: number, plan: Exclude<SubscriptionPlan, 'free'>, billingPeriod: BillingPeriod) {
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, orgId), columns: { trialStartedAt: true, subscriptionPlan: true, subscriptionStatus: true } })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  if (organization.trialStartedAt) throw createError({ statusCode: 409, statusMessage: 'This organization has already used its free trial.' })
  if (organization.subscriptionPlan !== 'free' || ['trialing', 'active', 'suspended'].includes(organization.subscriptionStatus)) {
    throw createError({ statusCode: 409, statusMessage: 'This organization already has paid-plan access.' })
  }
  const trialStartedAt = new Date()
  const trialEndsAt = new Date(trialStartedAt)
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  await db.update(tables.organizations).set({ subscriptionPlan: plan, subscriptionStatus: 'trialing', billingPeriod, trialStartedAt, trialEndsAt, subscriptionStartedAt: null, subscriptionEndsAt: null, cancelAtPeriodEnd: false, updatedAt: trialStartedAt }).where(eq(tables.organizations.id, orgId))
  return { plan, billingPeriod, trialStartedAt, trialEndsAt }
}

async function getStudentCount(orgId: number) {
  const [result] = await db.select({ value: count() }).from(tables.students).where(eq(tables.students.organizationId, orgId))
  return result?.value ?? 0
}

async function getDojoStudentCount(orgId: number, dojoId: number) {
  const [dojoResult] = await db.select({ value: count() }).from(tables.students).where(and(eq(tables.students.organizationId, orgId), eq(tables.students.dojoId, dojoId)))
  return dojoResult?.value ?? 0
}

async function getDojoCount(orgId: number) {
  const [result] = await db.select({ value: count() }).from(tables.dojos).where(eq(tables.dojos.organizationId, orgId))
  return result?.value ?? 0
}

async function getInstructorCount(dojoId: number) {
  const [result] = await db.select({ value: count() }).from(tables.dojoInstructors).where(eq(tables.dojoInstructors.dojoId, dojoId))
  return result?.value ?? 0
}

async function getHierarchyNodeCount(orgId: number) {
  const [result] = await db.select({ value: count() }).from(tables.hierarchyNodes).where(eq(tables.hierarchyNodes.organizationId, orgId))
  return result?.value ?? 0
}

export async function assertStudentLimit(orgId: number, dojoId?: number | null) {
  const { plan, limits } = await getSubscription(orgId)
  const used = await getStudentCount(orgId)
  if (limits.students !== null && used >= limits.students) {
    throw createError({ statusCode: 402, statusMessage: `${plan === 'free' ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1)} plan limit reached: upgrade to add more than ${limits.students} students` })
  }
  if (limits.studentsPerDojo !== null && dojoId) {
    const dojoStudents = await getDojoStudentCount(orgId, dojoId)
    if (dojoStudents >= limits.studentsPerDojo) {
      throw createError({ statusCode: 402, statusMessage: `${plan === 'city-starter' ? 'City Starter' : plan} plan limit reached: each dojo can have up to ${limits.studentsPerDojo} students` })
    }
  }
}

export async function assertDojoLimit(orgId: number) {
  const { plan, limits } = await getSubscription(orgId)
  const used = await getDojoCount(orgId)
  if (limits.dojos !== null && used >= limits.dojos) {
    throw createError({ statusCode: 402, statusMessage: `${plan === 'free' ? 'Free Forever' : 'City Starter'} plan limit reached: upgrade to manage more dojo locations.` })
  }
}

export async function assertDojoTerritory(orgId: number, location: { city?: string | null, stateProvince?: string | null, country?: string | null }) {
  const { plan } = await getSubscription(orgId)
  if (!['city-starter', 'city-pro', 'state-pro', 'national'].includes(plan)) return
  const normalize = (value: string | null | undefined) => value?.trim().toLocaleLowerCase() || ''
  const requiresCity = plan === 'city-starter' || plan === 'city-pro'
  const required = requiresCity ? ['city', 'stateProvince', 'country'] : plan === 'state-pro' ? ['stateProvince', 'country'] : ['country']
  if (required.some(key => !normalize(location[key as keyof typeof location]))) {
    const fields = requiresCity ? 'City, state/province, and country' : plan === 'state-pro' ? 'State/province and country' : 'Country'
    const planName = plan === 'national' ? 'National' : plan === 'state-pro' ? 'State Pro' : 'City'
    throw createError({ statusCode: 400, statusMessage: `${fields} are required for the ${planName} plan.` })
  }
  const firstDojo = await db.query.dojos.findFirst({ where: eq(tables.dojos.organizationId, orgId), orderBy: (dojo, { asc }) => [asc(dojo.id)] })
  if (!firstDojo) return
  const sameCountry = normalize(firstDojo.country) === normalize(location.country)
  const sameState = normalize(firstDojo.stateProvince) === normalize(location.stateProvince)
  const sameCity = normalize(firstDojo.city) === normalize(location.city)
  if (!sameCountry || (plan === 'state-pro' && !sameState) || (requiresCity && !sameCity)) {
    const message = plan === 'national'
      ? 'National workspaces can add locations only within their configured country.'
      : plan === 'state-pro'
        ? 'State Pro workspaces can add locations only within their configured state/province.'
        : 'City plan workspaces can add locations only within their configured city.'
    throw createError({ statusCode: 402, statusMessage: message })
  }
}

export async function assertStaffAccountLimit(orgId: number) {
  const { limits } = await getSubscription(orgId)
  if (limits.instructorsPerDojo === null) return
  const [result] = await db.select({ value: count() }).from(tables.users).where(eq(tables.users.organizationId, orgId))
  if ((result?.value || 0) >= 1) throw createError({ statusCode: 402, statusMessage: 'Free Forever includes one owner account. Upgrade to add staff.' })
}

export async function assertInstructorLimit(orgId: number, dojoId: number) {
  const { limits } = await getSubscription(orgId)
  const used = await getInstructorCount(dojoId)
  if (limits.instructorsPerDojo !== null && used >= limits.instructorsPerDojo) {
    throw createError({ statusCode: 402, statusMessage: 'Free Forever includes one owner/instructor. Upgrade to add staff.' })
  }
}

export async function assertFederationManagementAccess(orgId: number) {
  const { plan } = await getSubscription(orgId)
  const nodeCount = await getHierarchyNodeCount(orgId)
  if (plan === 'free' && nodeCount > 0) {
    throw createError({ statusCode: 402, statusMessage: 'Adding or restructuring hierarchy levels requires a paid plan.' })
  }
}

const hierarchyLevelsByPlan: Record<SubscriptionPlan, string[] | null> = {
  free: [],
  'city-starter': [],
  'city-pro': [],
  'state-pro': ['State / Province', 'District', 'City / Town', 'Branch'],
  national: null,
}

export async function assertHierarchyLevelAllowed(orgId: number, levelName: string) {
  const { plan } = await getSubscription(orgId)
  const allowed = hierarchyLevelsByPlan[plan]
  if (allowed === null) return
  if (!allowed.includes(levelName.trim())) {
    throw createError({ statusCode: 402, statusMessage: plan === 'free' ? 'Upgrade to manage a multi-location hierarchy.' : `${plan === 'state-pro' ? 'State Pro' : 'City'} workspaces cannot use the ${levelName} hierarchy type.` })
  }
}

export async function getAllowedHierarchyLevelNames(orgId: number) {
  const { plan } = await getSubscription(orgId)
  return hierarchyLevelsByPlan[plan]
}

export async function getSubscriptionUsage(orgId: number) {
  const [{ plan, limits }, students, dojos, hierarchyNodes] = await Promise.all([
    getSubscription(orgId),
    getStudentCount(orgId),
    getDojoCount(orgId),
    getHierarchyNodeCount(orgId),
  ])
  return { plan, limits, usage: { students, dojos, hierarchyNodes } }
}
