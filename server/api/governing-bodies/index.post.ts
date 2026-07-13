import { z } from 'zod'
import { db, tables } from '../../utils/database'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  level: z.enum(['international', 'national', 'state', 'district', 'city', 'local', 'other']),
  country: z.string().trim().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  contactName: z.string().trim().max(255).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(5000).optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || session.user.role !== 'owner') throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  const body = await readValidatedBody(event, bodySchema.parse)
  const [governingBody] = await db.insert(tables.governingBodies).values({
    organizationId: session.user.organizationId,
    ...body,
    website: body.website || null,
    contactEmail: body.contactEmail || null
  }).returning()
  return { success: true, governingBody }
})
