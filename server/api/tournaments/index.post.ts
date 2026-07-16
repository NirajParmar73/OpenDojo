import { z } from 'zod'
import { db, tables } from '../../utils/database'
const schema = z.object({ name: z.string().min(1), level: z.string().min(1), venue: z.string().optional(), startDate: z.string().date(), endDate: z.string().date().optional(), ageCutoffDate: z.string().date() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const body = await readValidatedBody(event, schema.parse)
  const [tournament] = await db.insert(tables.tournaments).values({ organizationId: session.user.organizationId, name: body.name, level: body.level, venue: body.venue || null, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : null, ageCutoffDate: new Date(body.ageCutoffDate) }).returning()
  return tournament
})
