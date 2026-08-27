import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { admissionTokenHash, getAdmissionForm, resolveAdmissionOrganization } from '../../../utils/admissions'
import { db, tables } from '../../../utils/database'
import { saveUploadedFile } from '../../../utils/upload'

const text = (parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) => parts?.find(part => part.name === name && !part.filename)?.data.toString().trim() || ''
const optionalId = z.preprocess(value => value === '' ? null : value, z.coerce.number().int().positive().nullable())
const schema = z.object({
  dojoId: z.coerce.number().int().positive(), programId: optionalId, currentBeltRankId: optionalId,
  firstName: z.string().min(1).max(100), lastName: z.string().min(1).max(100), email: z.string().email().max(200), phone: z.string().min(5).max(40),
  dateOfBirth: z.string().date(), gender: z.preprocess(value => value === '' ? null : value, z.enum(['male', 'female', 'other']).nullable()),
  originalJoinedAt: z.string().date(), currentBeltAwardedAt: z.preprocess(value => value === '' ? null : value, z.string().date().nullable()), membershipNumber: z.string().max(100),
  address: z.string().max(500), city: z.string().max(100), stateProvince: z.string().max(100), country: z.string().max(100), postalCode: z.string().max(30),
  emergencyContact: z.string().min(1).max(150), emergencyPhone: z.string().min(5).max(40), medicalNotes: z.string().max(2000),
  guardianName: z.string().max(150), guardianRelationship: z.string().max(100), guardianPhone: z.string().max(40), guardianEmail: z.preprocess(value => value === '' ? null : value, z.string().email().max(200).nullable()),
  consent: z.literal('true'), website: z.string().max(0),
})

export default defineEventHandler(async (event) => {
  const organization = await resolveAdmissionOrganization(event)
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization registration form not found' })
  const form = await getAdmissionForm(organization.id)
  if (!form.isExistingRegistrationPublished) throw createError({ statusCode: 404, statusMessage: 'Existing student registration is not currently open' })
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Invalid form submission' })
  const fields = ['dojoId', 'programId', 'currentBeltRankId', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'originalJoinedAt', 'currentBeltAwardedAt', 'membershipNumber', 'address', 'city', 'stateProvince', 'country', 'postalCode', 'emergencyContact', 'emergencyPhone', 'medicalNotes', 'guardianName', 'guardianRelationship', 'guardianPhone', 'guardianEmail', 'consent', 'website']
  const body = schema.parse(Object.fromEntries(fields.map(name => [name, text(parts, name)])))
  const now = new Date()
  const dateOfBirth = new Date(`${body.dateOfBirth}T00:00:00.000Z`)
  const originalJoinedAt = new Date(`${body.originalJoinedAt}T00:00:00.000Z`)
  if (dateOfBirth > now || originalJoinedAt > now) throw createError({ statusCode: 400, statusMessage: 'Birth and original joining dates cannot be in the future' })
  if (originalJoinedAt < dateOfBirth) throw createError({ statusCode: 400, statusMessage: 'Original joining date cannot be before the student was born' })
  if (body.currentBeltAwardedAt) {
    const awardedAt = new Date(`${body.currentBeltAwardedAt}T00:00:00.000Z`)
    if (awardedAt > now || awardedAt < originalJoinedAt) throw createError({ statusCode: 400, statusMessage: 'Rank awarded date must be between the original joining date and today' })
  }
  const adultCutoff = new Date(); adultCutoff.setFullYear(adultCutoff.getFullYear() - 18)
  if (dateOfBirth > adultCutoff && (!body.guardianName || !body.guardianRelationship || !body.guardianPhone)) throw createError({ statusCode: 400, statusMessage: 'Guardian name, relationship, and phone are required for students under 18' })
  const [dojo, program, rank] = await Promise.all([
    db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, body.dojoId), eq(tables.dojos.organizationId, organization.id)) }),
    body.programId ? db.query.organizationPrograms.findFirst({ where: and(eq(tables.organizationPrograms.id, body.programId), eq(tables.organizationPrograms.organizationId, organization.id)) }) : null,
    body.currentBeltRankId ? db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, body.currentBeltRankId), with: { system: true } }) : null,
  ])
  if (!dojo) throw createError({ statusCode: 400, statusMessage: 'Choose a valid dojo' })
  if (body.programId && (!program || !program.isActive)) throw createError({ statusCode: 400, statusMessage: 'Choose a valid program' })
  if (body.currentBeltRankId && (!rank || rank.system.organizationId !== organization.id || (body.programId && rank.system.programId && rank.system.programId !== body.programId))) throw createError({ statusCode: 400, statusMessage: 'Choose a valid current belt' })
  const photo = parts.find(part => part.name === 'photo' && part.filename)
  if (!photo?.data?.length) throw createError({ statusCode: 400, statusMessage: 'A profile photograph is required' })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type || '')) throw createError({ statusCode: 400, statusMessage: 'Use a JPG, PNG, or WebP photograph' })
  const uploaded = await saveUploadedFile({ name: photo.filename!, filename: photo.filename!, data: photo.data, type: photo.type }, 'admission-photos', ['image/jpeg', 'image/png', 'image/webp'])
  const token = randomBytes(32).toString('base64url')
  const referenceNumber = `REG-${now.getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
  const [application] = await db.insert(tables.admissionApplications).values({
    organizationId: organization.id, dojoId: dojo.id, programId: body.programId, applicationType: 'existing', referenceNumber, accessTokenHash: admissionTokenHash(token),
    firstName: body.firstName, lastName: body.lastName, email: body.email.toLowerCase(), phone: body.phone, dateOfBirth, gender: body.gender,
    address: body.address || null, city: body.city || null, stateProvince: body.stateProvince || null, country: body.country || null, postalCode: body.postalCode || null,
    emergencyContact: body.emergencyContact, emergencyPhone: body.emergencyPhone, medicalNotes: body.medicalNotes || null,
    guardianName: body.guardianName || null, guardianRelationship: body.guardianRelationship || null, guardianPhone: body.guardianPhone || null, guardianEmail: body.guardianEmail,
    originalJoinedAt, currentBeltRankId: body.currentBeltRankId, currentBeltAwardedAt: body.currentBeltAwardedAt ? new Date(`${body.currentBeltAwardedAt}T00:00:00.000Z`) : null,
    membershipNumber: body.membershipNumber || null, photoPath: uploaded.path, consentAcceptedAt: now,
    formSnapshot: { title: form.existingRegistrationTitle, introduction: form.existingRegistrationIntroduction, privacyNotice: form.privacyNotice, consentText: form.existingRegistrationConsentText },
  }).returning()
  return { referenceNumber: application!.referenceNumber, token, organizationSlug: organization.slug }
})
