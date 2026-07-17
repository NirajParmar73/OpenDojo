// server/api/auth/login.post.ts
import { z } from 'zod'
import { db, tables } from '../../../server/utils/database'
import { eq } from 'drizzle-orm'
import { currentTenant, workspaceUrl } from '../../utils/tenant'
import { isPlatformAdminEmail } from '../../utils/platform-admin'
// ✅ Import these from nuxt-auth-utils

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await db.query.users.findFirst({
    where: eq(tables.users.email, body.email),
  })

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  const tenant = currentTenant(event)
  if (tenant && user.organizationId !== tenant.id) {
    throw createError({ statusCode: 403, statusMessage: 'Use the workspace address for your organization to sign in' })
  }

  const isValid = await verifyPassword(user.passwordHash, body.password)
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  // Fetch organization name and logo
  let orgName = null
  let orgLogo = null
  let orgSlug = ''
  if (user.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(tables.organizations.id, user.organizationId),
    })
    orgName = org?.name ?? null
    orgLogo = org?.logo ?? null
    orgSlug = org?.slug ?? ''
    if (org?.subscriptionStatus === 'suspended' && !isPlatformAdminEmail(user.email)) {
      throw createError({ statusCode: 403, statusMessage: 'This organization has been suspended. Contact support.' })
    }
  }

  // ✅ Set session with all required fields
  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  await setUserSession(event, {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: orgName,
      organizationLogo: orgLogo,
      avatar: user.avatar || null,
      isPlatformAdmin,
    },
    lastLoggedIn: new Date(),
  })

  const baseDomain = String(useRuntimeConfig(event).tenantBaseDomain || '')
  return { success: true, isPlatformAdmin, workspaceUrl: orgSlug ? workspaceUrl(baseDomain, orgSlug) : '' }
})
