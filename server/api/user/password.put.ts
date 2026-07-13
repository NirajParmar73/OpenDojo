import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long').max(255)
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readValidatedBody(event, passwordSchema.parse)
  const user = await db.query.users.findFirst({ where: eq(tables.users.id, session.user.id) })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (!await verifyPassword(user.passwordHash, body.currentPassword)) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }

  if (await verifyPassword(user.passwordHash, body.newPassword)) {
    throw createError({ statusCode: 400, statusMessage: 'New password must be different from the current password' })
  }

  await db.update(tables.users)
    .set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() })
    .where(eq(tables.users.id, user.id))

  return { success: true }
})
