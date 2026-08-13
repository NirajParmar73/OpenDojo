import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { classifyAppHost, isTrustedWorkspaceLoginHandoff, portalAppUrl } from '../shared/utils/app-host.ts'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('installable apps start in the right surface and have distinct branding', async () => {
  const adminManifest = JSON.parse(await read('public/manifest.webmanifest'))
  const platformManifest = JSON.parse(await read('public/platform/manifest.webmanifest'))
  const manifest = JSON.parse(await read('public/portal/manifest.webmanifest'))
  assert.equal(adminManifest.start_url, '/auth/login?source=pwa')
  assert.equal(manifest.start_url, '/portal')
  assert.equal(manifest.scope, '/portal/')
  assert.equal(adminManifest.name, 'OpenDojos Admin')
  assert.equal(adminManifest.short_name, 'Dojo Admin')
  assert.equal(platformManifest.short_name, 'Dojo Platform')
  assert.equal(manifest.short_name, 'Dojo Student')
  const primaryIcon = pwaManifest => pwaManifest.icons.find(icon => icon.sizes === '192x192')?.src
  assert.equal(new Set([
    primaryIcon(adminManifest),
    primaryIcon(platformManifest),
    primaryIcon(manifest)
  ]).size, 3)
  const primaryIconFiles = await Promise.all(
    [adminManifest, platformManifest, manifest].map(pwaManifest =>
      readFile(new URL(`../public${primaryIcon(pwaManifest)}`, import.meta.url))
    )
  )
  assert.equal(new Set(primaryIconFiles.map(file => file.toString('base64'))).size, 3)
  assert.ok(adminManifest.icons.some(icon => icon.src === '/admin-pwa-icon-maskable-512.png' && icon.purpose === 'maskable'))
  assert.ok(platformManifest.icons.some(icon => icon.src === '/platform-pwa-icon-maskable-512.png' && icon.purpose === 'maskable'))
  assert.ok(manifest.icons.some(icon => icon.src === '/student-pwa-icon-maskable-512.png' && icon.purpose === 'maskable'))
  assert.equal(platformManifest.start_url, '/platform')
  assert.equal(platformManifest.id, '/platform')

  const portal = await read('app/pages/portal/index.vue')
  assert.match(portal, /middleware: 'portal-auth'/)

  const adminLayout = await read('app/layouts/default.vue')
  const portalLayout = await read('app/layouts/portal.vue')
  const staffLogin = await read('app/pages/auth/login.vue')
  const installButton = await read('app/components/PwaInstallButton.vue')
  assert.match(adminLayout, /Install Admin app/)
  assert.match(adminLayout, /Install Platform app/)
  assert.match(portalLayout, /Install Student app/)
  assert.match(installButton, /<UButton size="sm" icon="i-lucide-download"/)
  assert.match(installButton, /Open the browser menu/)
  assert.match(staffLogin, /user\.value\?\.role === 'student'/)
  assert.match(staffLogin, /platformAppUrl/)

  const app = await read('app/app.vue')
  const pwaPlugin = await read('app/plugins/pwa.client.ts')
  assert.match(app, /\/platform\/manifest\.webmanifest/)
  assert.match(app, /\/admin-pwa-icon-180\.png/)
  assert.match(app, /\/platform-pwa-icon-180\.png/)
  assert.match(app, /\/student-pwa-icon-180\.png/)
  assert.match(pwaPlugin, /\['platform', 'staff', 'portal', 'legacy'\]/)
})

test('application hosts isolate platform, staff, and tenant student portals', async () => {
  assert.deepEqual(classifyAppHost('opendojos.com', 'opendojos.com'), { surface: 'public', tenantSlug: null })
  assert.deepEqual(classifyAppHost('platform.opendojos.com', 'opendojos.com'), { surface: 'platform', tenantSlug: null })
  assert.deepEqual(classifyAppHost('app.opendojos.com', 'opendojos.com'), { surface: 'staff', tenantSlug: null })
  assert.deepEqual(classifyAppHost('kgi.opendojos.com', 'opendojos.com'), { surface: 'staff', tenantSlug: 'kgi' })
  assert.deepEqual(classifyAppHost('portal.opendojos.com', 'opendojos.com'), { surface: 'portal', tenantSlug: null })
  assert.deepEqual(classifyAppHost('kgi.portal.opendojos.com', 'opendojos.com'), { surface: 'portal', tenantSlug: 'kgi' })
  assert.equal(portalAppUrl('opendojos.com', 'kgi'), 'https://kgi.portal.opendojos.com/portal')

  const tenantMiddleware = await read('server/middleware/tenant.ts')
  const tenantUtility = await read('server/utils/tenant.ts')
  const staffLoginApi = await read('server/api/auth/login.post.ts')
  const staffLoginPage = await read('app/pages/auth/login.vue')
  assert.match(tenantMiddleware, /NUXT_ENFORCE_APP_SUBDOMAINS|enforceAppSubdomains/)
  assert.match(tenantMiddleware, /Student|session\?\.user\?\.role === 'student'/i)
  assert.match(tenantMiddleware, /pathname\.startsWith\('\/api\/platform\/'\)/)
  assert.match(tenantMiddleware, /pathname\.startsWith\('\/api\/portal\/'\)/)
  assert.match(tenantUtility, /classifyAppHost/)
  assert.match(staffLoginApi, /workspaceLoginUrl: workspaceUrl/)
  assert.match(staffLoginApi, /body\.redirectTo\.startsWith\('\/'\).*!\s*body\.redirectTo\.startsWith\('\/\/'\)/)
  assert.match(staffLoginPage, /form\.action = `\$\{response\.workspaceLoginUrl/)
  assert.match(staffLoginPage, /form\.method = 'POST'/)
})

test('only the central staff app can hand login to a tenant workspace', () => {
  const baseDomain = 'opendojos.com'
  assert.equal(isTrustedWorkspaceLoginHandoff('app.opendojos.com', 'kgi-karate.opendojos.com', baseDomain), true)
  assert.equal(isTrustedWorkspaceLoginHandoff('app.opendojos.com', 'platform.opendojos.com', baseDomain), false)
  assert.equal(isTrustedWorkspaceLoginHandoff('platform.opendojos.com', 'kgi-karate.opendojos.com', baseDomain), false)
  assert.equal(isTrustedWorkspaceLoginHandoff('attacker.example', 'kgi-karate.opendojos.com', baseDomain), false)
  assert.equal(isTrustedWorkspaceLoginHandoff('another-dojo.opendojos.com', 'kgi-karate.opendojos.com', baseDomain), false)
  assert.equal(isTrustedWorkspaceLoginHandoff('app.opendojos.com', 'attacker.example', baseDomain), false)
})

test('sessions are persistent and host-only', async () => {
  const config = await read('nuxt.config.ts')
  const environment = await read('.env.example')
  const renewal = await read('server/utils/session-renewal.ts')
  assert.match(config, /name: process\.env\.NODE_ENV === 'production' \? '__Host-opendojos-session'/)
  assert.match(config, /maxAge: 60 \* 60 \* 24 \* 365/)
  assert.match(config, /httpOnly: true/)
  assert.match(config, /sameSite: 'lax'/)
  assert.doesNotMatch(config, /NUXT_SESSION_COOKIE_DOMAIN/)
  assert.doesNotMatch(environment, /NUXT_SESSION_COOKIE_DOMAIN/)
  assert.match(renewal, /7 \* 24 \* 60 \* 60 \* 1000/)
  assert.match(renewal, /replaceUserSession/)
})

test('student sessions are constrained to student APIs and owned downloads', async () => {
  const middleware = await read('server/middleware/tenant-access.ts')
  const territoryMiddleware = await read('server/middleware/student-territory.ts')
  const progressReport = await read('server/api/students/[studentId]/progress-report.get.ts')
  const portalPage = await read('app/pages/portal/index.vue')
  const portalPassword = await read('server/api/portal/password.put.ts')
  assert.match(middleware, /Student portal sessions cannot access staff APIs/)
  assert.match(middleware, /ownProgressReport/)
  assert.match(middleware, /receiptDownload/)
  assert.match(middleware, /ownSessionRead[\s\S]*\/api\/_auth\/session/)
  assert.match(territoryMiddleware, /session\.user\.role === 'student'\) return/)
  assert.match(progressReport, /isOwnPortalReport/)
  assert.match(progressReport, /Content-Length/)
  assert.match(portalPage, /async function downloadPdf/)
  assert.match(portalPage, /content-type[\s\S]*application\/pdf/)
  assert.match(portalPage, /\/api\/payments\/\$\{payment\.id\}\/receipt/)
  assert.match(portalPassword, /verifyPassword\(account\.passwordHash, body\.currentPassword\)/)
  assert.match(portalPassword, /New password must be different from the current password/)
  assert.match(portalPassword, /hashPassword\(body\.newPassword\)/)
})

test('service worker never caches authenticated or uploaded data', async () => {
  const worker = await read('public/sw.js')
  const plugin = await read('app/plugins/pwa.client.ts')
  const prompt = await read('app/components/PwaUpdatePrompt.vue')
  const versionRoute = await read('server/routes/app-version.get.ts')
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(worker, /url\.pathname\.startsWith\('\/uploads\/'\)/)
  assert.match(worker, /request\.mode === 'navigate'/)
  assert.match(worker, /SKIP_WAITING/)
  assert.doesNotMatch(worker, /isBuildAsset/)
  assert.match(plugin, /import\.meta\.dev/)
  assert.match(plugin, /registration => registration\.unregister\(\)/)
  assert.match(plugin, /controllerchange/)
  assert.match(plugin, /\/app-version\?time=/)
  assert.match(plugin, /registration\.waiting\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/)
  assert.match(plugin, /window\.addEventListener\('focus', checkForUpdate\)/)
  assert.match(plugin, /30 \* 60 \* 1000/)
  assert.match(versionRoute, /Cache-Control[\s\S]*no-store/)
  assert.match(prompt, /A new version is ready/)
  assert.match(prompt, /Update now/)
})

test('student device notifications use authenticated subscriptions and background push delivery', async () => {
  const worker = await read('public/sw.js')
  const schema = await read('server/database/schema.ts')
  const subscribe = await read('server/api/portal/push-subscriptions/index.post.ts')
  const unsubscribe = await read('server/api/portal/push-subscriptions/index.delete.ts')
  const push = await read('server/utils/student-push.ts')
  const scheduler = await read('server/api/internal/notifications/dispatch.post.ts')
  const migration = await read('server/database/drizzle-postgres/0026_living_kid_colt.sql')

  assert.match(worker, /addEventListener\('push'/)
  assert.match(worker, /showNotification/)
  assert.match(worker, /addEventListener\('notificationclick'/)
  assert.match(worker, /target\.origin !== self\.location\.origin/)
  assert.match(schema, /studentPushSubscriptions = pgTable\('student_push_subscriptions'/)
  assert.match(schema, /endpoint: t\.text\(\)\.notNull\(\)\.unique\(\)/)
  assert.match(subscribe, /requireStudentPushRecipient/)
  assert.match(subscribe, /onConflictDoUpdate/)
  assert.match(unsubscribe, /studentPushSubscriptions\.studentId/)
  assert.match(push, /statusCode === 404 \|\| statusCode === 410/)
  assert.match(push, /url\.startsWith\('\/portal'\)/)
  assert.match(scheduler, /timingSafeEqual/)
  assert.match(scheduler, /NUXT_NOTIFICATION_CRON_SECRET|notificationCronSecret/)
  assert.match(migration, /CREATE TABLE "student_push_subscriptions"/)
  assert.match(migration, /ADD COLUMN "push_sent_at"/)
})

test('guided setup keeps tuition separate from inline additional charges', async () => {
  const onboarding = await read('app/pages/onboarding.vue')
  const guide = await read('app/pages/getting-started.vue')
  const login = await read('app/pages/auth/login.vue')
  assert.match(onboarding, /Grading exam fees and miscellaneous charges are added only while recording a payment/)
  assert.doesNotMatch(onboarding, /hierarchyStep|subscriptionPlan === 'national'/)
  assert.match(guide, /Additional charges remain separate from the tuition balance/)
  assert.match(guide, /choose only a higher target belt/)
  assert.match(guide, /Open your first receipt/)
  assert.match(guide, /requiredSteps\.value/)
  assert.match(login, /created === '1' \? '\/getting-started\?welcome=1'/)
})

test('guided setup and getting started surface the student spreadsheet importer', async () => {
  const onboarding = await read('app/pages/onboarding.vue')
  const guide = await read('app/pages/getting-started.vue')

  assert.match(onboarding, /guided CSV importer/)
  assert.match(onboarding, /Getting Started will take you directly to the importer/)
  assert.match(guide, /secondaryTo: .*'\/students\/import'/)
  assert.match(guide, /Import spreadsheet/)
})

test('payment student selector excludes inactive and archived students', async () => {
  const fees = await read('app/pages/fees/index.vue')

  assert.match(fees, /const filteredStudents[\s\S]*student\.status === 'active'/)
})

test('staff lifecycle status controls sign-in and existing sessions', async () => {
  const schema = await read('server/database/schema.ts')
  const editPage = await read('app/pages/users/[id]/edit.vue')
  const updateUser = await read('server/api/users/[id].patch.ts')
  const login = await read('server/api/auth/login.post.ts')
  const accessMiddleware = await read('server/middleware/tenant-access.ts')
  const permissions = await read('server/utils/permissions.ts')
  const migration = await read('server/database/drizzle-postgres/0023_staff_account_status.sql')

  assert.match(schema, /status: t\.text\(\{ enum: \['active', 'inactive', 'archived'\] \}\)\.notNull\(\)\.default\('active'\)/)
  assert.match(editPage, /Account status[\s\S]*New password/)
  assert.match(updateUser, /The organization owner account must remain active/)
  assert.match(login, /user\.status !== 'active'/)
  assert.match(accessMiddleware, /user\.status !== 'active'/)
  assert.match(permissions, /user\.role === 'owner' \|\| user\.role === 'admin'/)
  assert.match(permissions, /actorRole === 'owner' \|\| actorRole === 'admin'/)
  assert.match(migration, /users_status_valid/)
})

test('refunds preserve original payments and flow through balances and reports', async () => {
  const schema = await read('server/database/schema.ts')
  const migration = await read('server/database/drizzle-postgres/0021_majestic_miracleman.sql')
  const createRefund = await read('server/api/payments/[id]/refunds/index.post.ts')
  const feeBalance = await read('server/utils/fees.ts')
  const finance = await read('server/api/finance/overview.get.ts')
  const receipts = await read('app/pages/receipts.vue')

  assert.match(schema, /export const paymentRefunds = pgTable\('payment_refunds'/)
  assert.match(migration, /payment_refunds_amount_positive/)
  assert.match(createRefund, /for update/)
  assert.match(createRefund, /hasFinanceManagementAccess/)
  assert.match(createRefund, /Refunds require a finance management responsibility for this location/)
  assert.match(createRefund, /Refund exceeds the remaining refundable payment amount/)
  assert.match(feeBalance, /refundedTuition/)
  assert.match(finance, /grossCollections/)
  assert.match(finance, /refundedAmount/)
  assert.match(receipts, /Tuition portion returned/)
  assert.match(receipts, /The original receipt will be preserved/)
})

test('finance managers receive scoped receipt and refund access', async () => {
  const layout = await read('app/layouts/default.vue')
  const permissions = await read('server/utils/permissions.ts')
  assert.match(layout, /\{ label: 'Receipts', to: '\/receipts'/)
  assert.match(permissions, /financeManagerRoles/)
  assert.match(permissions, /isDojoWithinHierarchyNode\(organizationId, dojoId, assignment\.scopeId\)/)
})

test('fee-period corrections are permission checked and audited', async () => {
  const correction = await read('server/api/payments/[id]/billing-period.patch.ts')
  assert.match(correction, /hasFinanceManagementAccess/)
  assert.match(correction, /payment\.student\.organizationId !== organizationId/)
  assert.match(correction, /payment\.billing_period_corrected/)
  assert.match(correction, /reason: z\.string\(\)\.trim\(\)\.min\(3/)
  assert.match(correction, /24 months in the future/)
  assert.match(correction, /does not align with this fee plan schedule/)
})

test('database migrations remain in strictly increasing journal order', async () => {
  const journal = JSON.parse(await read('server/database/drizzle-postgres/meta/_journal.json'))
  assert.ok(journal.entries.every((entry, index) => index === 0 || entry.when > journal.entries[index - 1].when))
})

test('production runtime has readiness, request protection and database health checks', async () => {
  const readiness = await read('server/plugins/production-readiness.ts')
  const security = await read('server/middleware/request-security.ts')
  const health = await read('server/api/health.get.ts')
  assert.match(readiness, /NUXT_SESSION_PASSWORD/)
  assert.match(readiness, /NUXT_PUBLIC_APP_URL must use HTTPS/)
  assert.match(readiness, /Web Push public key, private key, subject, and notification cron secret must be configured together/)
  assert.match(readiness, /NUXT_NOTIFICATION_CRON_SECRET must contain at least 32 characters/)
  assert.match(readiness, /statusCode >= 500 \? 'error' : 'warn'/)
  assert.match(security, /Too many requests/)
  assert.match(security, /Cross-origin request blocked/)
  assert.match(security, /pathname === '\/api\/auth\/login'/)
  assert.match(security, /parsedOrigin\.protocol === 'https:'/)
  assert.match(security, /isTrustedWorkspaceLoginHandoff/)
  assert.match(health, /select 1/)
})

test('development dependencies and repeated hierarchy deletes stay quiet', async () => {
  const config = await read('nuxt.config.ts')
  const deleteNode = await read('server/api/hierarchy/nodes/[id].delete.ts')
  assert.match(config, /optimizeDeps[\s\S]*include: \['zod\/v4'\]/)
  assert.match(deleteNode, /alreadyDeleted: true/)
})

test('Business pricing and trial expiry behavior stay consistent', async () => {
  const pricing = await read('app/pages/pricing.vue')
  const subscriptionPage = await read('app/pages/settings/subscription.vue')
  const razorpay = await read('server/utils/razorpay.ts')
  const subscription = await read('server/utils/subscription.ts')

  assert.match(pricing, /business'.*monthly: 1999, annual: 19990/)
  assert.match(subscriptionPage, /business' as const.*monthly: 1999, annual: 19990/)
  assert.match(razorpay, /business: \{ monthly: 199900, annual: 1999000 \}/)
  assert.match(subscription, /subscriptionPlan: 'free', subscriptionStatus: 'expired'/)
  assert.match(subscription, /plan !== 'business'.*Optional location groups/)
  assert.match(pricing, /no automatic charge/i)
  assert.match(pricing, /Existing records are retained/)
})

test('public discovery exposes pricing and crawler metadata', async () => {
  const home = await read('app/pages/index.vue')
  const robots = await read('public/robots.txt')
  const sitemap = await read('public/sitemap.xml')

  assert.match(home, /aria-label="Primary navigation"[\s\S]*to="\/pricing"/)
  assert.doesNotMatch(home, /to="\/pricing" class="hidden/)
  assert.match(robots, /Sitemap: https:\/\/opendojos\.com\/sitemap\.xml/)
  assert.match(robots, /Disallow: \/api\//)
  assert.match(sitemap, /<loc>https:\/\/opendojos\.com\/pricing<\/loc>/)
  assert.doesNotMatch(sitemap, /<loc>https:\/\/opendojos\.com\/(?:settings|students|portal)(?:\/|<)/)
})

test('location managers receive territory-scoped staff management', async () => {
  const layout = await read('app/layouts/default.vue')
  const staffPage = await read('app/pages/users/index.vue')
  const avatarUpload = await read('server/api/users/[id]/avatar.post.ts')
  const certificateUpload = await read('server/api/users/[id]/certificate.post.ts')

  assert.match(layout, /const canManageStaff = computed\(\(\) =>[\s\S]*canManageLocations\.value/)
  assert.match(layout, /staffPermissions\.value\?\.allowedRoles[\s\S]*includes\('instructor'\)/)
  assert.match(staffPage, /v-if="user\.canEdit" class="flex items-center gap-1"/)
  assert.match(avatarUpload, /canEditManagedUser/)
  assert.match(certificateUpload, /canEditManagedUser/)
})

test('territory managers grant student portal access only inside their scope', async () => {
  const permissions = await read('server/utils/permissions.ts')
  const portalRead = await read('server/api/students/[studentId]/portal-account.get.ts')
  const portalWrite = await read('server/api/students/[studentId]/portal-account.post.ts')
  const studentPage = await read('app/pages/students/[id].vue')
  const accessPage = await read('app/pages/students/[id]/portal-access.vue')
  const portalPage = await read('app/pages/portal/index.vue')
  const forcedPasswordPage = await read('app/pages/portal/change-password.vue')

  assert.match(permissions, /studentPortalManagerRoles = \[\.\.\.financeManagerRoles\]/)
  assert.match(permissions, /hasStudentPortalManagementAccess/)
  assert.doesNotMatch(permissions, /!studentPortalManagerRoles\.includes\(user\.role\)/)
  assert.match(permissions, /isDojoWithinHierarchyNode\(organizationId, dojoId, assignment\.scopeId\)/)
  assert.match(portalRead, /hasStudentPortalManagementAccess/)
  assert.match(portalWrite, /hasStudentPortalManagementAccess/)
  assert.match(portalWrite, /student\.portal_access\.(?:reset|created)/)
  assert.match(studentPage, /v-if="canManagePortalAccess"/)
  assert.match(studentPage, /accessProfile\.value\?\.assignments/)
  assert.match(accessPage, /middleware: 'auth'/)
  assert.doesNotMatch(accessPage, /middleware: \['auth', 'admin'\]/)
  assert.match(portalPage, /data\.student\.avatar/)
  assert.match(portalPage, /\{ label: 'Password', value: 'password' \}/)
  assert.match(portalPage, /v-else-if="tab === 'password'"/)
  assert.match(portalPage, /\/api\/portal\/password/)
  assert.match(portalPage, /passwordForm\.newPassword !== passwordForm\.confirmPassword/)
  assert.match(forcedPasswordPage, /\/api\/portal\/password/)
  assert.match(forcedPasswordPage, /form\.newPassword !== form\.confirmPassword/)
})

test('dojo geography inherits the manager territory without guessing across territories', async () => {
  const permissions = await read('server/utils/permissions.ts')
  const permissionApi = await read('server/api/users/me/permissions.ts')
  const dojoPage = await read('app/pages/dojos.vue')
  const createDojo = await read('server/api/dojos/index.post.ts')

  assert.match(permissions, /locations\.every\(location => location\[field\] === value\)/)
  assert.match(permissionApi, /territoryDefaults/)
  assert.match(dojoPage, /inherited from your assigned territory/)
  assert.match(dojoPage, /function applyTerritoryDefaults/)
  assert.match(createDojo, /territoryDefaults\.stateProvince \|\| body\.stateProvince/)
})

test('student spreadsheet imports preview safely and reuse transactional enrolment', async () => {
  const studentPage = await read('app/pages/students/index.vue')
  const importPage = await read('app/pages/students/import.vue')
  const preview = await read('server/api/student-imports/preview.post.ts')
  const commit = await read('server/api/student-imports/commit.post.ts')
  const enrollment = await read('server/services/student-enrollment.ts')
  const studentCreate = await read('server/api/students/index.post.ts')

  assert.match(studentPage, /to="\/students\/import"/)
  assert.match(importPage, /Nothing is saved until you review the preview/)
  assert.match(preview, /MAX_FILE_SIZE/)
  assert.match(preview, /MAX_ROWS/)
  assert.match(commit, /prepareStudentImportRows/)
  assert.match(commit, /students\.import/)
  assert.match(enrollment, /db\.transaction/)
  assert.match(enrollment, /tables\.studentProgramEnrollments/)
  assert.match(enrollment, /tables\.studentFeeAssignments/)
  assert.match(studentCreate, /enrollStudent/)
})

test('shared page fragments use compiled Vue components', async () => {
  const affectedPages = await Promise.all([
    read('app/pages/students/[id].vue'),
    read('app/pages/students/index.vue'),
    read('app/pages/finance.vue')
  ])
  const compiledComponents = await Promise.all([
    read('app/components/InfoItem.vue'),
    read('app/components/EmptyState.vue'),
    read('app/components/StudentAvatar.vue'),
    read('app/components/MetricCard.vue')
  ])

  for (const page of affectedPages) {
    assert.doesNotMatch(page, /defineComponent\([\s\S]*?template:\s*['"]/)
  }
  for (const component of compiledComponents) {
    assert.match(component, /<template>/)
  }
})
