// server/api/onboarding.post.ts
import { db, tables } from '../../server/utils/database'
import { eq } from 'drizzle-orm'
import { saveUploadedFile } from '../../server/utils/upload'
import { currentTenant, organizationSlug, reservedSubdomains, workspaceUrl } from '../utils/tenant'
import { sendVerificationEmail } from '../utils/email-verification'

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
  const workspaceSlug = getField('workspaceSlug')
  const dojoName = getField('dojoName')
  const dojoAddress = getField('dojoAddress')
  const dojoCity = getField('dojoCity')
  const dojoStateProvince = getField('dojoStateProvince')
  const dojoCountry = getField('dojoCountry')
  const districtName = getField('districtName')?.trim()
  const branchName = getField('branchName')?.trim()
  const feeName = getField('feeName')
  const feeAmount = Number(getField('feeAmount'))
  const currency = getField('currency')
  const name = getField('name')
  const email = getField('email')
  const password = getField('password')
  const martialArt = getField('martialArt')
  const style = getField('style')
  const requestedTrialPlan = getField('trialPlan')
  const requestedBillingPeriod = getField('billingPeriod')
  const staffField = getField('staff')
  const logoFilePart = form.find((p) => p.name === 'logo' && p.filename)

  if (!orgName?.trim() || !workspaceSlug?.trim() || !dojoName?.trim() || !dojoAddress?.trim() || !dojoCity?.trim() || !dojoStateProvince?.trim() || !dojoCountry?.trim() || !name?.trim() || !email?.trim() || !password || !martialArt?.trim() || !style?.trim() || !feeName?.trim() || !Number.isInteger(feeAmount) || feeAmount < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 8 characters' })
  }
  const supportedCurrencies = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'INR', 'SGD', 'AED', 'ZAR', 'BRL', 'MXN'])
  if (!currency || !supportedCurrencies.has(currency)) throw createError({ statusCode: 400, statusMessage: 'Choose a supported organization currency' })
  if (!/^\S+@\S+\.\S+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'Enter a valid owner email address' })
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
  const slug = organizationSlug(workspaceSlug || orgName)
  if (!slug || reservedSubdomains.has(slug)) throw createError({ statusCode: 400, statusMessage: 'Choose a different workspace address' })
  const existingOrg = await db.query.organizations.findFirst({
    where: eq(tables.organizations.slug, slug),
  })
  if (existingOrg) {
    throw createError({ statusCode: 409, statusMessage: 'That workspace address is already taken' })
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

  // Provision all database records atomically; a failed setup cannot leave a
  // partially-created organization behind.
  const provisioned = await db.transaction(async tx => {
  const [org] = await tx.insert(tables.organizations).values({
    name: orgName,
    slug,
    logo: logoPath,
    currency,
    subscriptionPlan: trialPlan || 'free',
    subscriptionStatus: trialPlan ? 'trialing' : 'free',
    billingPeriod: trialPlan ? (requestedBillingPeriod || 'annual') : null,
    trialStartedAt,
    trialEndsAt,
  }).returning()

  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create organization' })
  }

  // State and National plans receive a ready-to-use hierarchy. City and Free
  // workspaces remain intentionally simple with one internal dojo node.
  const hierarchyNames = trialPlan === 'national'
    ? ['Country', 'State / Province', 'District', 'City / Town', 'Branch', 'Dojo']
    : trialPlan === 'state-pro'
      ? ['State / Province', 'District', 'City / Town', 'Branch', 'Dojo']
      : ['Dojo']
  const levels = await tx.insert(tables.hierarchyLevels).values(hierarchyNames.map((name, index) => ({ organizationId: org.id, name, order: index + 1 }))).returning()
  const levelByName = new Map(levels.map(level => [level.name, level]))
  let parentId: number | null = null
  const nodeLabels: Record<string, string | null> = {
    Country: dojoCountry.trim(),
    'State / Province': dojoStateProvince.trim(),
    District: districtName || null,
    'City / Town': dojoCity.trim(),
    Branch: branchName || dojoName,
  }
  for (const levelName of hierarchyNames.filter(name => name !== 'Dojo')) {
    const label = nodeLabels[levelName]
    if (!label) continue
    const [createdNode] = await tx.insert(tables.hierarchyNodes).values({ organizationId: org.id, levelId: levelByName.get(levelName)!.id, parentId, name: label }).returning()
    parentId = createdNode!.id
  }
  const [node] = await tx.insert(tables.hierarchyNodes).values({ organizationId: org.id, levelId: levelByName.get('Dojo')!.id, parentId, name: dojoName }).returning()
  const [dojo] = await tx.insert(tables.dojos).values({ organizationId: org.id, nodeId: node!.id, name: dojoName, address: dojoAddress || null, city: dojoCity.trim(), stateProvince: dojoStateProvince.trim(), country: dojoCountry.trim() }).returning()

  const [program] = await tx.insert(tables.organizationPrograms).values({
    organizationId: org.id,
    martialArt,
    style,
    displayName: `${martialArt.replaceAll('_', ' ')} - ${style.replaceAll('_', ' ')}`,
    isPrimary: 1,
  }).returning()

  // Only create a rank system where the selected discipline normally uses one.
  // Combat sports and custom arts start without arbitrary coloured belts.
  const rankTemplates: Record<string, string[] | undefined> = {
    bjj: ['White', 'Blue', 'Purple', 'Brown', 'Black'], judo: ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Brown', 'Black'], karate: ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black'], taekwondo: ['White', 'Yellow', 'Green', 'Blue', 'Red', 'Black'], hapkido: ['White', 'Yellow', 'Green', 'Blue', 'Red', 'Black'], aikido: ['White', 'Yellow', 'Green', 'Blue', 'Brown', 'Black'], kendo: ['6th Kyu', '5th Kyu', '4th Kyu', '3rd Kyu', '2nd Kyu', '1st Kyu', '1st Dan'], iaido: ['6th Kyu', '5th Kyu', '4th Kyu', '3rd Kyu', '2nd Kyu', '1st Kyu', '1st Dan'], tang_soo_do: ['White', 'Orange', 'Green', 'Red', 'Blue', 'Black'],
  }
  const rankNames = rankTemplates[martialArt]
  if (rankNames) {
  const [beltSystem] = await tx.insert(tables.beltSystems).values({
    organizationId: org.id,
    programId: program?.id,
    name: 'Default Belt System',
  }).returning()
  if (beltSystem) await tx.insert(tables.beltRanks).values(rankNames.map((rank, index) => ({ systemId: beltSystem.id, name: rank.includes('Kyu') || rank.includes('Dan') ? rank : `${rank} Belt`, level: rank.toLowerCase().replaceAll(' ', '_'), order: index + 1, type: rank.includes('Dan') || rank === 'Black' ? 'dan' : 'kyu', danNumber: rank.includes('Dan') || rank === 'Black' ? 1 : null, color: rank.toLowerCase().replaceAll(' belt', '') })))
  }

  if (dojo) {
    const [feePlan] = await tx.insert(tables.feePlans).values({ organizationId: org.id, dojoId: dojo.id, name: feeName, amount: feeAmount * 100, frequency: 'monthly', description: 'Created during workspace setup', isActive: 1 }).returning()
    if (feePlan) await tx.update(tables.dojos).set({ defaultFeePlanId: feePlan.id, updatedAt: new Date() }).where(eq(tables.dojos.id, dojo.id))
  }

  // Create user
  const hashed = await hashPassword(password)
  const [user] = await tx.insert(tables.users).values({
    name,
    email,
    passwordHash: hashed,
    role: 'owner',
    organizationId: org.id,
  }).returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user' })
  }

  // The workspace owner is ready to teach at the first dojo immediately.
  if (dojo) await tx.insert(tables.dojoInstructors).values({ dojoId: dojo.id, userId: user.id, programId: program?.id || null, isPrimary: 1 })

  if (dojo) {
    for (const member of staff) {
      const [staffUser] = await tx.insert(tables.users).values({ name: member.name.trim(), email: member.email.trim(), passwordHash: await hashPassword(member.password), role: 'member', organizationId: org.id }).returning()
      if (staffUser) await tx.insert(tables.assignments).values({ userId: staffUser.id, role: member.assignmentRole, scopeType: 'dojo', scopeId: dojo.id })
    }
  }

  return { org, user }
  })
  const { org, user } = provisioned

  try { await sendVerificationEmail(event, user) } catch (error) { console.error('Could not send verification email', error) }

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
