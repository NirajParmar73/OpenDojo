import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('student PWA starts inside the protected portal and has distinct branding', async () => {
  const manifest = JSON.parse(await read('public/portal/manifest.webmanifest'))
  assert.equal(manifest.start_url, '/portal')
  assert.equal(manifest.scope, '/portal/')
  assert.ok(manifest.icons.some(icon => icon.src === '/student-pwa-icon.svg'))

  const portal = await read('app/pages/portal/index.vue')
  assert.match(portal, /middleware: 'portal-auth'/)

  const adminLayout = await read('app/layouts/default.vue')
  const portalLayout = await read('app/layouts/portal.vue')
  const installButton = await read('app/components/PwaInstallButton.vue')
  assert.match(adminLayout, /Install Admin app/)
  assert.match(portalLayout, /Install Student app/)
  assert.match(installButton, /<UButton size="sm" icon="i-lucide-download"/)
  assert.match(installButton, /Open the browser menu/)
})

test('student sessions are constrained to student APIs and owned downloads', async () => {
  const middleware = await read('server/middleware/tenant-access.ts')
  assert.match(middleware, /Student portal sessions cannot access staff APIs/)
  assert.match(middleware, /ownProgressReport/)
  assert.match(middleware, /receiptDownload/)
  assert.match(middleware, /ownSessionRead[\s\S]*\/api\/_auth\/session/)
})

test('service worker never caches authenticated or uploaded data', async () => {
  const worker = await read('public/sw.js')
  const plugin = await read('app/plugins/pwa.client.ts')
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(worker, /url\.pathname\.startsWith\('\/uploads\/'\)/)
  assert.match(worker, /request\.mode === 'navigate'/)
  assert.doesNotMatch(worker, /isBuildAsset/)
  assert.match(plugin, /import\.meta\.dev/)
  assert.match(plugin, /registration => registration\.unregister\(\)/)
})

test('guided setup keeps tuition separate from inline additional charges', async () => {
  const onboarding = await read('app/pages/onboarding.vue')
  const guide = await read('app/pages/getting-started.vue')
  assert.match(onboarding, /Grading exam fees and miscellaneous charges are added only while recording a payment/)
  assert.doesNotMatch(onboarding, /hierarchyStep|subscriptionPlan === 'national'/)
  assert.match(guide, /Additional charges remain separate from the tuition balance/)
  assert.match(guide, /choose only a higher target belt/)
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
  assert.match(createRefund, /Only organization administrators can record refunds/)
  assert.match(createRefund, /Refund exceeds the remaining refundable payment amount/)
  assert.match(feeBalance, /refundedTuition/)
  assert.match(finance, /grossCollections/)
  assert.match(finance, /refundedAmount/)
  assert.match(receipts, /Tuition portion returned/)
  assert.match(receipts, /The original receipt will be preserved/)
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
  assert.match(readiness, /statusCode >= 500 \? 'error' : 'warn'/)
  assert.match(security, /Too many requests/)
  assert.match(security, /Cross-origin request blocked/)
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
