import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { sendVerificationEmail } from '../../utils/email-verification'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().email('Enter a valid email address').max(255),
  danDegree: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  stateProvince: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code').transform(value => value.toUpperCase()).nullable().optional(),
  subdivisionCode: z.string().trim().max(20).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
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
      ...(body.address !== undefined ? { address: body.address || null } : {}),
      ...(body.city !== undefined ? { city: body.city || null } : {}),
      ...(body.stateProvince !== undefined ? { stateProvince: body.stateProvince || null } : {}),
      ...(body.country !== undefined ? { country: body.country || null } : {}),
      ...(body.countryCode !== undefined ? { countryCode: body.countryCode || null } : {}),
      ...(body.subdivisionCode !== undefined ? { subdivisionCode: body.subdivisionCode || null } : {}),
      ...(body.postalCode !== undefined ? { postalCode: body.postalCode || null } : {}),
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
      avatar: updatedUser.avatar,
      address: updatedUser.address,
      city: updatedUser.city,
      stateProvince: updatedUser.stateProvince,
      country: updatedUser.country,
      countryCode: updatedUser.countryCode,
      subdivisionCode: updatedUser.subdivisionCode,
      postalCode: updatedUser.postalCode,
    }
  }
})
