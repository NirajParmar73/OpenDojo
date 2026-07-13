// server/api/onboarding.post.ts
import { db, tables } from '../../server/utils/database'
import { eq } from 'drizzle-orm'
import { saveUploadedFile } from '../../server/utils/upload'
import { currentTenant } from '../utils/tenant'

export default defineEventHandler(async (event) => {
  if (currentTenant(event)) throw createError({ statusCode: 403, statusMessage: 'New organizations must be created from the main OpenDojo site' })
  console.log('📝 Onboarding started')
  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const getField = (name: string): string | null => {
  const part = form.find((p) => p.name === name)
  return part ? part.data.toString() : null
}
  const orgName = getField('organizationName')
  const name = getField('name')
  const email = getField('email')
  const password = getField('password')
  const martialArt = getField('martialArt')
  const style = getField('style')
  const logoFilePart = form.find((p) => p.name === 'logo' && p.filename)

  if (!orgName || !name || !email || !password || !martialArt || !style) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }

  // Check existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(tables.users.email, email),
  })
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  // Check slug uniqueness
  const slug = orgName.toLowerCase().replace(/\s+/g, '-')
  const existingOrg = await db.query.organizations.findFirst({
    where: eq(tables.organizations.slug, slug),
  })
  if (existingOrg) {
    throw createError({ statusCode: 409, statusMessage: 'Organization name already taken' })
  }

  // Save logo if uploaded
  let logoPath: string | null = null
  if (logoFilePart && logoFilePart.data) {
    try {
      const savedLogo = await saveUploadedFile(
        {
          name: logoFilePart.filename || 'logo',
          data: logoFilePart.data,
          filename: logoFilePart.filename || 'logo',
          type: logoFilePart.type || 'image/jpeg',
        },
        'logos'
      )
      logoPath = savedLogo.path
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err.message || 'Logo upload failed' })
    }
  }

  // Create organization
  const [org] = await db.insert(tables.organizations).values({
    name: orgName,
    slug,
    logo: logoPath,
  }).returning()

  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create organization' })
  }

  const [program] = await db.insert(tables.organizationPrograms).values({
    organizationId: org.id,
    martialArt,
    style,
    displayName: `${martialArt.replaceAll('_', ' ')} - ${style.replaceAll('_', ' ')}`,
    isPrimary: 1,
  }).returning()

  // Create default belt system for the organization
try {
  await db.insert(tables.beltSystems).values({
    organizationId: org.id,
    programId: program?.id,
    name: 'Default Belt System',
  })
} catch (error) {
  console.warn('Failed to create default belt system:', error)
  // Continue, as we can create it later
}

  // Create user
  const hashed = await hashPassword(password)
  const [user] = await db.insert(tables.users).values({
    name,
    email,
    passwordHash: hashed,
    role: 'owner',
    organizationId: org.id,
  }).returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' })
  }

  // ✅ Set session with ALL required fields
  // After creating the user, set session
await setUserSession(event, {
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    organizationName: org.name,
    organizationLogo: org.logo ?? null, // 👈 add this
    avatar: null,
  },
  lastLoggedIn: new Date(),
})

  console.log('✅ Onboarding successful, session set for:', email)

  return {
    success: true,
    organization: { id: org.id, name: org.name, slug: org.slug, logo: org.logo },
    user: { id: user.id, name: user.name, email: user.email },
  }
})
