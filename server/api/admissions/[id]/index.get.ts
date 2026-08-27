import { and, eq, or, sql } from 'drizzle-orm'
import { requireAdmissionApplication } from '../../../utils/admission-access'
import { db, tables } from '../../../utils/database'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { user, application } = await requireAdmissionApplication(event, id)
  const duplicates = await db.query.students.findMany({
    where: and(eq(tables.students.organizationId, user.organizationId!), or(
      eq(tables.students.email, application.email),
      eq(tables.students.phone, application.phone),
      application.membershipNumber ? eq(tables.students.membershipNumber, application.membershipNumber) : sql`false`,
      and(eq(tables.students.firstName, application.firstName), eq(tables.students.lastName, application.lastName), eq(tables.students.dateOfBirth, application.dateOfBirth)),
    )),
    columns: { id: true, firstName: true, lastName: true, email: true, phone: true, membershipNumber: true, dojoId: true },
    limit: 10,
  })
  return { ...application, duplicates }
})
