import { z } from 'zod'
import { asc, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { requirePlatformAdmin } from '../../../../utils/platform-admin'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  const organizationId = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  return db.query.users.findMany({
    where: eq(tables.users.organizationId, organizationId),
    columns: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [asc(tables.users.name)],
  })
})
