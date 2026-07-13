import { z } from 'zod'
import { db, tables } from '../../utils/database'
const schema = z.object({ userId: z.number().int().positive(), programId: z.number().int().positive().nullable(), qualification: z.string().min(1).max(255), issuer: z.string().max(255).optional(), expiresAt: z.string().date().optional() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const body = await readValidatedBody(event, schema.parse)
  const [qualification] = await db.insert(tables.instructorQualifications).values({ organizationId: session.user.organizationId, ...body, issuer: body.issuer || null, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }).returning()
  return { success: true, qualification }
})
