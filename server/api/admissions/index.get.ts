import { desc, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { hasStudentPortalManagementAccess } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const user = session.user
  const organizationId = user.organizationId!
  const applications = await db.query.admissionApplications.findMany({
    where: eq(tables.admissionApplications.organizationId, organizationId),
    with: { dojo: { columns: { id: true, name: true } }, program: { columns: { id: true, displayName: true } }, resultingStudent: { columns: { id: true } } },
    orderBy: [desc(tables.admissionApplications.submittedAt)],
  })
  const visible = await Promise.all(applications.map(async application => await hasStudentPortalManagementAccess(user.id, organizationId, application.dojoId) ? application : null))
  return visible.filter(Boolean)
})
