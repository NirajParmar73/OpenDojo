import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { verificationHash } from '../../utils/email-verification'
export default defineEventHandler(async event => {
  const { token } = z.object({ token: z.string().length(64) }).parse(await readBody(event))
  const record = await db.query.emailVerificationTokens.findFirst({ where: eq(tables.emailVerificationTokens.tokenHash, verificationHash(token)) })
  if (!record || record.expiresAt < new Date()) throw createError({ statusCode: 400, statusMessage: 'This verification link is invalid or expired' })
  await db.update(tables.users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(tables.users.id, record.userId))
  await db.delete(tables.emailVerificationTokens).where(eq(tables.emailVerificationTokens.id, record.id))
  return { success: true }
})
