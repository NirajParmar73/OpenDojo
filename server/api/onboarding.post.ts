// server/api/onboarding.post.ts
import { db, tables } from '../../server/utils/database'
import { eq } from 'drizzle-orm'
import { saveUploadedFile } from '../../server/utils/upload'
import { currentTenant, organizationSlug, reservedSubdomains, workspaceUrl } from '../utils/tenant'

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
  const dojoName = getField('dojoName')
  const dojoAddress = getField('dojoAddress')
  const feeName = getField('feeName')
  const feeAmount = Number(getField('feeAmount'))
  const name = getField('name')
  const email = getField('email')
  const password = getField('password')
  const martialArt = getField('martialArt')
  const style = getField('style')
  const requestedTrialPlan = getField('trialPlan')
  const requestedBillingPeriod = getField('billingPeriod')
  const staffField = getField('staff')
  const logoFilePart = form.find((p) => p.name === 'logo' && p.filename)

  if (!orgName || !dojoName || !name || !email || !password || !martialArt || !style || !feeName || !Number.isInteger(feeAmount) || feeAmount < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }
  const trialPlans = ['city-starter', 'city-pro', 'state-pro', 'national'] as const
  const trialPlan = trialPlans.includes(requestedTrialPlan as typeof trialPlans[number]) ? requestedTrialPlan as typeof trialPlans[number] : null
  if (requestedTrialPlan && !trialPlan) throw createError({ statusCode: 400, statusMessage: 'Invalid trial plan' })
  if (requestedBillingPeriod && requestedBillingPeriod !== 'monthly' && requestedBillingPeriod !== 'annual') throw createError({ statusCode: 400, statusMessage: 'Invalid billing period' })
  const trialStartedAt = trialPlan ? new Date() : null
  const trialEndsAt = trialStartedAt ? new Date(trialStartedAt.getTime() + 14 * 24 * 60 * 60 * 1000) : null
  let staff: Array<{ name: string, email: string, password: string, assignmentRole: 'instructor' | 'dojo_head' }> = []
  try { staff = staffField ? JSON.parse(staffField) : [] } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid staff details' }) }
  if (!Array.isArray(staff) || staff.some(member => !member?.name?.trim() || !/^\S+@\S+\.\S+$/.test(member.email) || member.password?.length < 8 || !['instructor', 'dojo_head'].includes(member.assignmentRole))) throw createError({ statusCode: 400, statusMessage: 'Each staff member needs a name, email, role, and temporary password.' })
  if (staff.length && !trialPlan) throw createError({ statusCode: 402, statusMessage: 'Add staff by starting a paid-plan trial or upgrading your workspace.' })
  const allEmails = [email.toLowerCase(), ...staff.map(member => member.email.toLowerCase())]
  if (new Set(allEmails).size !== allEmails.length) throw createError({ statusCode: 400, statusMessage: 'Each team member must have a different email address.' })

  // Check existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(tables.users.email, email),
  })
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }
  for (const member of staff) {
    const existingStaffUser = await db.query.users.findFirst({ where: eq(tables.users.email, member.email.trim()) })
    if (existingStaffUser) throw createError({ statusCode: 409, statusMessage: `${member.email} is already registered` })
  }

  // Check slug uniqueness
  const slug = organizationSlug(orgName)
  if (!slug || reservedSubdomains.has(slug)) throw createError({ statusCode: 400, statusMessage: 'Choose a different organization name for the workspace address' })
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
    subscriptionPlan: trialPlan || 'free',
    subscriptionStatus: trialPlan ? 'trialing' : 'free',
    billingPeriod: trialPlan ? (requestedBillingPeriod || 'annual') : null,
    trialStartedAt,
    trialEndsAt,
  }).returning()

  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create organization' })
  }

  const [level] = await db.insert(tables.hierarchyLevels).values({ organizationId: org.id, name: 'Main location', order: 1 }).returning()
  const [node] = await db.insert(tables.hierarchyNodes).values({ organizationId: org.id, levelId: level!.id, name: dojoName }).returning()
  const [dojo] = await db.insert(tables.dojos).values({ organizationId: org.id, nodeId: node!.id, name: dojoName, address: dojoAddress || null }).returning()

  const [program] = await db.insert(tables.organizationPrograms).values({
    organizationId: org.id,
    martialArt,
    style,
    displayName: `${martialArt.replaceAll('_', ' ')} - ${style.replaceAll('_', ' ')}`,
    isPrimary: 1,
  }).returning()

  // Create default belt system for the organization
try {
  const [beltSystem] = await db.insert(tables.beltSystems).values({
    organizationId: org.id,
    programId: program?.id,
    name: 'Default Belt System',
  }).returning()
  const rankNames = martialArt === 'bjj' ? ['White', 'Blue', 'Purple', 'Brown', 'Black'] : ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black']
  if (beltSystem) await db.insert(tables.beltRanks).values(rankNames.map((rank, index) => ({ systemId: beltSystem.id, name: `${rank} Belt`, level: rank.toLowerCase(), order: index + 1, type: rank === 'Black' ? 'dan' : 'kyu', danNumber: rank === 'Black' ? 1 : null, color: rank.toLowerCase() })))
} catch (error) {
  console.warn('Failed to create default belt system:', error)
  // Continue, as we can create it later
}

  if (dojo) {
    const [feePlan] = await db.insert(tables.feePlans).values({ organizationId: org.id, dojoId: dojo.id, name: feeName, amount: feeAmount * 100, frequency: 'monthly', description: 'Created during workspace setup', isActive: 1 }).returning()
    if (feePlan) await db.update(tables.dojos).set({ defaultFeePlanId: feePlan.id, updatedAt: new Date() }).where(eq(tables.dojos.id, dojo.id))
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

  if (dojo) {
    for (const member of staff) {
      const [staffUser] = await db.insert(tables.users).values({ name: member.name.trim(), email: member.email.trim(), passwordHash: await hashPassword(member.password), role: 'member', organizationId: org.id }).returning()
      if (staffUser) await db.insert(tables.assignments).values({ userId: staffUser.id, role: member.assignmentRole, scopeType: 'dojo', scopeId: dojo.id })
    }
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

  // New owners sign in explicitly after setup so they can confirm their account works.
  await clearUserSession(event)
  const baseDomain = String(useRuntimeConfig(event).tenantBaseDomain || '')
  return {
    success: true,
    organization: { id: org.id, name: org.name, slug: org.slug, logo: org.logo },
    user: { id: user.id, name: user.name, email: user.email },
    workspaceUrl: workspaceUrl(baseDomain, org.slug),
  }
})
