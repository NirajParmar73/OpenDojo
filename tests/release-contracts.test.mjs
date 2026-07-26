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
})

test('student sessions are constrained to student APIs and owned downloads', async () => {
  const middleware = await read('server/middleware/tenant-access.ts')
  assert.match(middleware, /Student portal sessions cannot access staff APIs/)
  assert.match(middleware, /ownProgressReport/)
  assert.match(middleware, /receiptDownload/)
})

test('service worker never caches authenticated or uploaded data', async () => {
  const worker = await read('public/sw.js')
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/)
  assert.match(worker, /url\.pathname\.startsWith\('\/uploads\/'\)/)
  assert.match(worker, /request\.mode === 'navigate'/)
})

test('guided setup keeps tuition separate from inline additional charges', async () => {
  const onboarding = await read('app/pages/onboarding.vue')
  const guide = await read('app/pages/getting-started.vue')
  assert.match(onboarding, /Grading exam fees and miscellaneous charges are added only while recording a payment/)
  assert.doesNotMatch(onboarding, /hierarchyStep|subscriptionPlan === 'national'/)
  assert.match(guide, /Additional charges remain separate from the tuition balance/)
  assert.match(guide, /choose only a higher target belt/)
})

test('production runtime has readiness, request protection and database health checks', async () => {
  const readiness = await read('server/plugins/production-readiness.ts')
  const security = await read('server/middleware/request-security.ts')
  const health = await read('server/api/health.get.ts')
  assert.match(readiness, /NUXT_SESSION_PASSWORD/)
  assert.match(readiness, /NUXT_PUBLIC_APP_URL must use HTTPS/)
  assert.match(security, /Too many requests/)
  assert.match(security, /Cross-origin request blocked/)
  assert.match(health, /select 1/)
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
