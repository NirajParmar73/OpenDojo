// server/api/organization/settings.get.ts
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const org = await db.query.organizations.findFirst({
    where: eq(tables.organizations.id, session.user.organizationId!),
  })

  if (!org) {
    throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    currency: org.currency || 'INR', // ✅ return currency
  }
})