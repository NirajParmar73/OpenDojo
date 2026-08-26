import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Play Store packages use distinct verified PWA surfaces and API 36', async () => {
  const adminManifest = JSON.parse(await read('android/admin/twa-manifest.json'))
  const studentManifest = JSON.parse(await read('android/student/twa-manifest.json'))
  const adminGradle = await read('android/admin/app/build.gradle')
  const studentGradle = await read('android/student/app/build.gradle')

  assert.equal(adminManifest.packageId, 'com.opendojos.admin')
  assert.equal(adminManifest.host, 'app.opendojos.com')
  assert.equal(adminManifest.startUrl, '/auth/login?source=play')
  assert.equal(studentManifest.packageId, 'com.opendojos.student')
  assert.equal(studentManifest.host, 'portal.opendojos.com')
  assert.equal(studentManifest.startUrl, '/portal/login?source=play')
  for (const gradle of [adminGradle, studentGradle]) {
    assert.match(gradle, /compileSdkVersion 36/)
    assert.match(gradle, /targetSdkVersion 36/)
  }
})

test('Play distribution keeps web billing out of the Android experience', async () => {
  const detection = await read('app/composables/usePlayDistribution.ts')
  const loginApi = await read('server/api/auth/login.post.ts')
  const subscription = await read('app/pages/settings/subscription.vue')

  assert.match(detection, /route\.query\.source === 'play'/)
  assert.match(detection, /opendojos-play-distribution/)
  assert.match(loginApi, /client: z\.enum\(\['play_admin'\]\)/)
  assert.match(loginApi, /body\.client !== 'play_admin'/)
  assert.match(subscription, /v-if="!isPlayDistribution"/)
  assert.match(subscription, /Plan purchasing is unavailable in this app/)
})

test('Play apps expose Digital Asset Links and account deletion', async () => {
  const assetLinks = await read('server/routes/.well-known/assetlinks.json.get.ts')
  const deletionPage = await read('app/pages/account-deletion.vue')
  const deletionApi = await read('server/api/account-deletion-requests.post.ts')

  assert.match(assetLinks, /com\.opendojos\.admin/)
  assert.match(assetLinks, /com\.opendojos\.student/)
  assert.match(assetLinks, /ANDROID_ADMIN_SHA256_FINGERPRINTS/)
  assert.match(assetLinks, /ANDROID_STUDENT_SHA256_FINGERPRINTS/)
  assert.match(deletionPage, /AccountDeletionRequest/)
  assert.match(deletionApi, /Verify identity and ownership before deleting any data/)
})
