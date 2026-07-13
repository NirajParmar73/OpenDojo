import { and, eq } from 'drizzle-orm'
import { db, tables } from '../utils/database'
import { isDojoAccessible } from '../utils/permissions'

export default defineEventHandler(async event => {
  const match = getRequestPath(event).match(/^\/api\/dojos\/(\d+)(?:\/|$)/)
  if (!match) return
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) return
  const dojoId = Number(match[1])
  const dojo = await db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, dojoId), eq(tables.dojos.organizationId, session.user.organizationId)) })
  if (!dojo) throw createError({ statusCode: 404, statusMessage: 'Dojo not found' })
  if (!await isDojoAccessible(session.user.id, session.user.organizationId, dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'This dojo is outside your assigned territory' })
  }
})
