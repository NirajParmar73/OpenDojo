import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'

const schema = z.object({ martialArt: z.string().trim().min(1).max(100), style: z.string().trim().min(1).max(100) })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid program' })
  const body = await readValidatedBody(event, schema.parse)
  const [program] = await db.update(tables.organizationPrograms)
    .set({ martialArt: body.martialArt, style: body.style, displayName: `${body.martialArt} - ${body.style}`, updatedAt: new Date() })
    .where(and(eq(tables.organizationPrograms.id, id), eq(tables.organizationPrograms.organizationId, session.user.organizationId)))
    .returning()
  if (!program) throw createError({ statusCode: 404, statusMessage: 'Program not found' })
  return { success: true, program }
})
