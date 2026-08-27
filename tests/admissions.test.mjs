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

test('selecting an admission dojo fills its shared location fields only', async () => {
  const formEndpoint = await read('server/api/public/admissions/form.get.ts')
  const admissionPage = await read('app/pages/admissions/index.vue')

  assert.match(formEndpoint, /columns:\s*\{\s*id: true, name: true, city: true, stateProvince: true, country: true\s*\}/)
  assert.match(admissionPage, /const selectedDojo = computed/)
  assert.match(admissionPage, /watch\(selectedDojo/)
  assert.match(admissionPage, /form\.city = dojo\?\.city \|\| ''/)
  assert.match(admissionPage, /form\.stateProvince = dojo\?\.stateProvince \|\| ''/)
  assert.match(admissionPage, /form\.country = dojo\?\.country \|\| ''/)
  assert.doesNotMatch(admissionPage, /form\.address = dojo\?\./)
  assert.doesNotMatch(admissionPage, /form\.postalCode = dojo\?\./)
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

test('existing students can self-register without receiving portal access before approval', async () => {
  const page = await read('app/pages/existing-student-registration.vue')
  const submission = await read('server/api/public/existing-student-registrations/index.post.ts')
  const approval = await read('server/api/admissions/[id]/approve.post.ts')
  const security = await read('server/middleware/request-security.ts')

  assert.doesNotMatch(page, /middleware:\s*['"]auth/)
  assert.match(page, /Portal access is created only after a manager approves/)
  assert.match(submission, /applicationType: 'existing'/)
  assert.match(submission, /originalJoinedAt/)
  assert.match(submission, /REG-/)
  assert.match(security, /existing-student-registrations/)
  assert.match(approval, /grantPortalAccess/)
  assert.match(approval, /portalCredentials/)
})

test('existing student fee tracking starts independently from historical membership', async () => {
  const enrollment = await read('server/services/student-enrollment.ts')
  const approval = await read('server/api/admissions/[id]/approve.post.ts')
  const schema = await read('server/database/schema.ts')

  assert.match(schema, /originalJoinedAt/)
  assert.match(schema, /applicationType/)
  assert.match(enrollment, /feeStartDate/)
  assert.match(enrollment, /startDate: body\.feeStartDate/)
  assert.match(approval, /fee tracking.*starts/)
})

test('existing registrations support duplicate matching before creating a student', async () => {
  const details = await read('server/api/admissions/[id]/index.get.ts')
  const reviewPage = await read('app/pages/admissions/[id].vue')
  const approval = await read('server/api/admissions/[id]/approve.post.ts')

  assert.match(details, /membershipNumber/)
  assert.match(details, /dateOfBirth/)
  assert.match(reviewPage, /Update #/)
  assert.match(approval, /matchedStudentId/)
  assert.match(approval, /existing_registration\.matched/)
})
