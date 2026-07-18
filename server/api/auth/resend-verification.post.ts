import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { sendVerificationEmail } from '../../utils/email-verification'
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const user = await db.query.users.findFirst({ where: eq(tables.users.id, session.user.id) })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  if (user.emailVerifiedAt) return { success: true, alreadyVerified: true }
  await sendVerificationEmail(event, user)
  return { success: true }
})
