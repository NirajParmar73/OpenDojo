import { count, desc } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { requirePlatformAdmin } from '../../utils/platform-admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)

  const [organizations, users, students, dojos, recentOrganizations] = await Promise.all([
    db.select({ value: count() }).from(tables.organizations),
    db.select({ value: count() }).from(tables.users),
    db.select({ value: count() }).from(tables.students),
    db.select({ value: count() }).from(tables.dojos),
    db.query.organizations.findMany({
      orderBy: [desc(tables.organizations.createdAt)],
      limit: 5,
      columns: { id: true, name: true, slug: true, subscriptionPlan: true, createdAt: true },
    }),
  ])

  const planRows = await db.query.organizations.findMany({ columns: { subscriptionPlan: true } })
  const plans = planRows.reduce<Record<string, number>>((result, organization) => {
    const plan = organization.subscriptionPlan || 'free'
    result[plan] = (result[plan] || 0) + 1
    return result
  }, {})
  // These reflect the public monthly list price, not collected payments.
  const monthlyPrice: Record<string, number> = { 'city-starter': 99, 'city-pro': 249, 'state-pro': 499, national: 999 }
  const estimatedMrr = planRows.reduce((total, organization) => total + (monthlyPrice[organization.subscriptionPlan] || 0), 0)

  return {
    totals: {
      organizations: organizations[0]?.value || 0,
      users: users[0]?.value || 0,
      students: students[0]?.value || 0,
      dojos: dojos[0]?.value || 0,
    },
    plans,
    revenue: {
      estimatedMrr,
      estimatedArr: estimatedMrr * 12,
      payingWorkspaces: Object.entries(plans).reduce((total, [plan, value]) => total + (plan === 'free' ? 0 : value), 0),
      customEnterpriseWorkspaces: 0,
    },
    recentOrganizations,
  }
})
