import { count, eq } from 'drizzle-orm'
import { db, tables } from './database'

export const subscriptionPlans = ['free', 'starter', 'growth', 'professional', 'enterprise'] as const
export type SubscriptionPlan = typeof subscriptionPlans[number]

const planLimits: Record<SubscriptionPlan, { students: number | null, dojos: number | null, instructorsPerDojo: number | null }> = {
  free: { students: 20, dojos: 1, instructorsPerDojo: 1 },
  starter: { students: 100, dojos: 1, instructorsPerDojo: 1 },
  growth: { students: 300, dojos: 1, instructorsPerDojo: 1 },
  professional: { students: null, dojos: 1, instructorsPerDojo: null },
  enterprise: { students: null, dojos: null, instructorsPerDojo: null },
}

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  return subscriptionPlans.includes(plan as SubscriptionPlan) ? plan as SubscriptionPlan : 'free'
}

export async function getSubscription(orgId: number) {
  const organization = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, orgId),
    columns: { subscriptionPlan: true },
  })
  const plan = normalizePlan(organization?.subscriptionPlan)
  return { plan, limits: planLimits[plan] }
}

async function getStudentCount(orgId: number) {
  const [result] = await db.select({ value: count() }).from(tables.students).where(eq(tables.students.organizationId, orgId))
  return result?.value ?? 0
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

export async function assertStudentLimit(orgId: number) {
  const { plan, limits } = await getSubscription(orgId)
  const used = await getStudentCount(orgId)
  if (limits.students !== null && used >= limits.students) {
    throw createError({ statusCode: 402, statusMessage: `${plan === 'free' ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1)} plan limit reached: upgrade to add more than ${limits.students} students` })
  }
}

export async function assertDojoLimit(orgId: number) {
  const { plan, limits } = await getSubscription(orgId)
  const used = await getDojoCount(orgId)
  if (limits.dojos !== null && used >= limits.dojos) {
    throw createError({ statusCode: 402, statusMessage: `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan includes one dojo. Upgrade to Enterprise to manage multiple branches.` })
  }
}

export async function assertInstructorLimit(orgId: number, dojoId: number) {
  const { plan, limits } = await getSubscription(orgId)
  const used = await getInstructorCount(dojoId)
  if (limits.instructorsPerDojo !== null && used >= limits.instructorsPerDojo) {
    throw createError({ statusCode: 402, statusMessage: `${plan === 'free' ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1)} plan includes one instructor per dojo. Upgrade to Professional to add multiple instructors.` })
  }
}

export async function assertFederationManagementAccess(orgId: number) {
  const { plan } = await getSubscription(orgId)
  const nodeCount = await getHierarchyNodeCount(orgId)
  if (plan !== 'enterprise' && nodeCount > 0) {
    throw createError({ statusCode: 402, statusMessage: 'Federation and multi-level hierarchy management requires the Enterprise plan.' })
  }
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
