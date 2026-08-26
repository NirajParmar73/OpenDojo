import { db, tables } from '../../utils/database'
import { getAdmissionForm } from '../../utils/admissions'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || !['owner', 'admin'].includes(session.user.role)) throw createError({ statusCode: 403, statusMessage: 'Organization administrator access required' })
  const [form, organization] = await Promise.all([
    getAdmissionForm(session.user.organizationId),
    db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId) }),
  ])
  return { ...form, organization: { name: organization?.name, slug: organization?.slug, logo: organization?.logo } }
})

