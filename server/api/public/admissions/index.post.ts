import { randomBytes, randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { admissionTokenHash, getAdmissionForm, resolveAdmissionOrganization } from '../../../utils/admissions'
import { db, tables } from '../../../utils/database'
import { saveUploadedFile } from '../../../utils/upload'

const text = (parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) => parts?.find(part => part.name === name && !part.filename)?.data.toString().trim() || ''

const schema = z.object({
  dojoId: z.coerce.number().int().positive(),
  programId: z.preprocess(value => value === '' ? null : value, z.coerce.number().int().positive().nullable()),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().min(5).max(40),
  dateOfBirth: z.string().date(),
  gender: z.preprocess(value => value === '' ? null : value, z.enum(['male', 'female', 'other']).nullable()),
  address: z.string().max(500),
  city: z.string().max(100),
  stateProvince: z.string().max(100),
  country: z.string().max(100),
  postalCode: z.string().max(30),
  emergencyContact: z.string().min(1).max(150),
  emergencyPhone: z.string().min(5).max(40),
  medicalNotes: z.string().max(2000),
  guardianName: z.string().max(150),
  guardianRelationship: z.string().max(100),
  guardianPhone: z.string().max(40),
  guardianEmail: z.preprocess(value => value === '' ? null : value, z.string().email().max(200).nullable()),
  previousExperience: z.string().max(2000),
  preferredStartDate: z.preprocess(value => value === '' ? null : value, z.string().date().nullable()),
  consent: z.literal('true'),
  website: z.string().max(0),
})

export default defineEventHandler(async (event) => {
  const organization = await resolveAdmissionOrganization(event)
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization admission form not found' })
  const form = await getAdmissionForm(organization.id)
  if (!form.isPublished) throw createError({ statusCode: 404, statusMessage: 'This organization is not accepting online applications' })
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Invalid form submission' })
  const body = schema.parse(Object.fromEntries([
    'dojoId', 'programId', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'city', 'stateProvince', 'country', 'postalCode', 'emergencyContact', 'emergencyPhone', 'medicalNotes', 'guardianName', 'guardianRelationship', 'guardianPhone', 'guardianEmail', 'previousExperience', 'preferredStartDate', 'consent', 'website',
  ].map(name => [name, text(parts, name)])))

  const dateOfBirth = new Date(`${body.dateOfBirth}T00:00:00.000Z`)
  if (dateOfBirth > new Date()) throw createError({ statusCode: 400, statusMessage: 'Date of birth cannot be in the future' })
  const adultCutoff = new Date()
  adultCutoff.setFullYear(adultCutoff.getFullYear() - 18)
  if (dateOfBirth > adultCutoff && (!body.guardianName || !body.guardianRelationship || !body.guardianPhone)) {
    throw createError({ statusCode: 400, statusMessage: 'Guardian name, relationship, and phone are required for applicants under 18' })
  }

  const [dojo, program] = await Promise.all([
    db.query.dojos.findFirst({ where: and(eq(tables.dojos.id, body.dojoId), eq(tables.dojos.organizationId, organization.id)) }),
    body.programId ? db.query.organizationPrograms.findFirst({ where: and(eq(tables.organizationPrograms.id, body.programId), eq(tables.organizationPrograms.organizationId, organization.id)) }) : null,
  ])
  if (!dojo) throw createError({ statusCode: 400, statusMessage: 'Choose a valid dojo' })
  if (body.programId && (!program || !program.isActive)) throw createError({ statusCode: 400, statusMessage: 'Choose a valid program' })

  const photo = parts.find(part => part.name === 'photo' && part.filename)
  if (!photo?.data?.length) throw createError({ statusCode: 400, statusMessage: 'A profile photograph is required' })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type || '')) throw createError({ statusCode: 400, statusMessage: 'Use a JPG, PNG, or WebP photograph' })
  const uploaded = await saveUploadedFile({ name: photo.filename!, filename: photo.filename!, data: photo.data, type: photo.type }, 'admission-photos', ['image/jpeg', 'image/png', 'image/webp'])

  const token = randomBytes(32).toString('base64url')
  const referenceNumber = `ADM-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
  const now = new Date()
  const [application] = await db.insert(tables.admissionApplications).values({
    organizationId: organization.id,
    dojoId: dojo.id,
    programId: body.programId,
    referenceNumber,
    accessTokenHash: admissionTokenHash(token),
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email.toLowerCase(),
    phone: body.phone,
    dateOfBirth,
    gender: body.gender,
    address: body.address || null,
    city: body.city || null,
    stateProvince: body.stateProvince || null,
    country: body.country || null,
    postalCode: body.postalCode || null,
    emergencyContact: body.emergencyContact,
    emergencyPhone: body.emergencyPhone,
    medicalNotes: body.medicalNotes || null,
    guardianName: body.guardianName || null,
    guardianRelationship: body.guardianRelationship || null,
    guardianPhone: body.guardianPhone || null,
    guardianEmail: body.guardianEmail,
    previousExperience: body.previousExperience || null,
    preferredStartDate: body.preferredStartDate ? new Date(`${body.preferredStartDate}T00:00:00.000Z`) : null,
    photoPath: uploaded.path,
    consentAcceptedAt: now,
    formSnapshot: { title: form.title, introduction: form.introduction, physicalCopyInstructions: form.physicalCopyInstructions, privacyNotice: form.privacyNotice, consentText: form.consentText, requirePhysicalCopy: form.requirePhysicalCopy },
  }).returning()

  return { referenceNumber: application!.referenceNumber, token, organizationSlug: organization.slug, physicalCopyInstructions: form.physicalCopyInstructions }
})

