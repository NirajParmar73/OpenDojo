import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { sendVerificationEmail } from '../../utils/email-verification'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().email('Enter a valid email address').max(255),
  danDegree: z.string().trim().max(100).nullable().optional()
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readValidatedBody(event, profileSchema.parse)
  const userId = session.user.id
  const user = await db.query.users.findFirst({ where: eq(tables.users.id, userId) })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (body.email !== user.email) {
    const emailInUse = await db.query.users.findFirst({ where: eq(tables.users.email, body.email) })
    if (emailInUse) {
      throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    }
  }

  const emailChanged = body.email !== user.email
  const [updatedUser] = await db.update(tables.users)
    .set({
      name: body.name,
      email: body.email,
      danDegree: body.danDegree || null,
      emailVerifiedAt: emailChanged ? null : user.emailVerifiedAt,
      updatedAt: new Date()
    })
    .where(eq(tables.users.id, userId))
    .returning()

  if (!updatedUser) {
    throw createError({ statusCode: 500, statusMessage: 'Could not update profile' })
  }

  session.user.name = updatedUser.name
  session.user.email = updatedUser.email
  await setUserSession(event, session)
  if (emailChanged) {
    try { await sendVerificationEmail(event, updatedUser) } catch (error) { console.error('Could not send verification email', error) }
  }

  return {
    success: true,
    user: {
      name: updatedUser.name,
      email: updatedUser.email,
      danDegree: updatedUser.danDegree,
      avatar: updatedUser.avatar
    }
  }
})
