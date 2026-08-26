import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public admissions are tenant-derived and require a profile photograph', async () => {
  const tenant = await read('server/utils/admissions.ts')
  const submission = await read('server/api/public/admissions/index.post.ts')

  assert.match(tenant, /currentTenant\(event\)/)
  assert.match(tenant, /local development possible without wildcard DNS/)
  assert.doesNotMatch(submission, /organizationId: body\./)
  assert.match(submission, /A profile photograph is required/)
  assert.match(submission, /\['image\/jpeg', 'image\/png', 'image\/webp'\]/)
  assert.match(submission, /Guardian name, relationship, and phone are required/)
})

test('the public admission dojo dropdown includes batch timings', async () => {
  const formEndpoint = await read('server/api/public/admissions/form.get.ts')
  const admissionPage = await read('app/pages/admissions/index.vue')

  assert.match(formEndpoint, /with:\s*\{\s*schedules:/)
  assert.match(formEndpoint, /dayOfWeek: true, startTime: true, endTime: true, name: true/)
  assert.match(admissionPage, /formatBatchSchedules/)
  assert.match(admissionPage, /group\.days\.filter\(Boolean\)\.join\('-'\)/)
  assert.doesNotMatch(admissionPage, /schedule\.name \?/)
  assert.match(admissionPage, /dojo\.schedules/)
})

test('admission approval creates a student without granting portal access', async () => {
  const approval = await read('server/api/admissions/[id]/approve.post.ts')
  const schema = await read('server/database/schema.ts')

  assert.match(approval, /enrollStudent/)
  assert.match(approval, /grantPortalAccess: false/)
  assert.match(approval, /Record the physical copy before approving/)
  assert.match(schema, /resultingStudentId/)
  assert.match(schema, /admission_applications_resulting_student_unique/)
})

test('submitted admission PDFs remain available through an unguessable token', async () => {
  const submission = await read('server/api/public/admissions/index.post.ts')
  const download = await read('server/api/public/admissions/[token]/pdf.get.ts')
  const pdf = await read('server/utils/admission-pdf.ts')

  assert.match(submission, /randomBytes\(32\)\.toString\('base64url'\)/)
  assert.match(download, /admissionTokenHash\(token\)/)
  assert.match(download, /Cache-Control': 'private, no-store'/)
  assert.match(pdf, /PENDING APPROVAL/)
  assert.match(pdf, /Applicant \/ guardian signature/)
  assert.match(pdf, /For organization use only/)
})
