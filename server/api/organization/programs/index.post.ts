import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq } from 'drizzle-orm'

const schema = z.object({ martialArt: z.string().trim().min(1).max(100), style: z.string().trim().min(1).max(100), isPrimary: z.boolean().optional() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const body = await readValidatedBody(event, schema.parse)
  if (body.isPrimary) await db.update(tables.organizationPrograms).set({ isPrimary: 0 }).where(eq(tables.organizationPrograms.organizationId, session.user.organizationId))
  const [program] = await db.insert(tables.organizationPrograms).values({ organizationId: session.user.organizationId, martialArt: body.martialArt, style: body.style, displayName: `${body.martialArt} - ${body.style}`, isPrimary: body.isPrimary ? 1 : 0 }).returning()
  return { success: true, program }
})
