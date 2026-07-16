import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'

const schema = z.object({
  name: z.string().min(1),
  level: z.string().min(1),
  venue: z.string().optional(),
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  ageCutoffDate: z.string().date(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })
  const body = await readValidatedBody(event, schema.parse)
  const [tournament] = await db.update(tables.tournaments)
    .set({ name: body.name, level: body.level, venue: body.venue || null, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null, ageCutoffDate: new Date(body.ageCutoffDate), updatedAt: new Date() })
    .where(and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, session.user.organizationId)))
    .returning()

  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  return tournament
})
