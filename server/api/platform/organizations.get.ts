import { asc } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { requirePlatformAdmin } from '../../utils/platform-admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)

  const [organizations, allUsers, allStudents, allDojos] = await Promise.all([
    db.query.organizations.findMany({ orderBy: [asc(tables.organizations.name)] }),
    db.query.users.findMany({ columns: { organizationId: true } }),
    db.query.students.findMany({ columns: { organizationId: true } }),
    db.query.dojos.findMany({ columns: { organizationId: true } }),
  ])

  const counts = (rows: Array<{ organizationId: number | null }>) => rows.reduce<Map<number, number>>((result, row) => {
    if (row.organizationId) result.set(row.organizationId, (result.get(row.organizationId) || 0) + 1)
    return result
  }, new Map())
  const users = counts(allUsers)
  const students = counts(allStudents)
  const dojos = counts(allDojos)

  return organizations.map(organization => ({
    ...organization,
    users: users.get(organization.id) || 0,
    students: students.get(organization.id) || 0,
    dojos: dojos.get(organization.id) || 0,
  }))
})
