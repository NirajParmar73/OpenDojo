import { and, eq, or } from 'drizzle-orm'
import { requireAdmissionApplication } from '../../../utils/admission-access'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { user, application } = await requireAdmissionApplication(event, id)
  const duplicates = await db.query.students.findMany({
    where: and(eq(tables.students.organizationId, user.organizationId!), or(eq(tables.students.email, application.email), eq(tables.students.phone, application.phone))),
    columns: { id: true, firstName: true, lastName: true, email: true, phone: true },
    limit: 10,
  })
  return { ...application, duplicates }
})
