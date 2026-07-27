import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../utils/database'
import { getAccessibleDojoIds, isDojoWithinHierarchyNode } from '../utils/permissions'
import { getSubscriptionUsage } from '../utils/subscription'
import type { CreateStudentInput } from './student-enrollment'

const optionalText = z.string().trim().max(1000).optional().default('')
export const studentImportInputSchema = z.object({
  firstName: optionalText,
  lastName: optionalText,
  email: optionalText,
  phone: optionalText,
  dateOfBirth: optionalText,
  joinedAt: optionalText,
  dojo: optionalText,
  program: optionalText,
  currentBelt: optionalText,
  feePlan: optionalText,
  status: optionalText,
  gender: optionalText,
  address: optionalText,
  city: optionalText,
  stateProvince: optionalText,
  country: optionalText,
  countryCode: optionalText,
  postalCode: optionalText,
  emergencyContact: optionalText,
  emergencyPhone: optionalText,
  medicalNotes: optionalText,
  discount: optionalText,
  discountReason: optionalText,
  guardianName: optionalText,
  guardianRelationship: optionalText,
  guardianPhone: optionalText,
  guardianEmail: optionalText,
})
export type StudentImportInput = z.infer<typeof studentImportInputSchema>

const headerAliases: Record<keyof StudentImportInput | 'fullName', string[]> = {
  firstName: ['firstname', 'first', 'givenname'],
  lastName: ['lastname', 'last', 'surname', 'familyname'],
  fullName: ['studentname', 'fullname', 'name'],
  email: ['email', 'emailaddress', 'studentemail'],
  phone: ['phone', 'mobile', 'mobilenumber', 'phonenumber', 'studentphone'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate'],
  joinedAt: ['joineddate', 'datejoined', 'admissiondate', 'startdate', 'joinedat'],
  dojo: ['dojo', 'branch', 'location', 'school'],
  program: ['program', 'course', 'discipline', 'martialart'],
  currentBelt: ['currentbelt', 'belt', 'rank', 'currentrank'],
  feePlan: ['feeplan', 'tuitionplan', 'membershipplan', 'fees'],
  status: ['status', 'studentstatus'],
  gender: ['gender', 'sex'],
  address: ['address', 'streetaddress'],
  city: ['city', 'town'],
  stateProvince: ['stateprovince', 'state', 'province', 'region'],
  country: ['country'],
  countryCode: ['countrycode'],
  postalCode: ['postalcode', 'zipcode', 'zip', 'pincode'],
  emergencyContact: ['emergencycontact', 'emergencycontactname'],
  emergencyPhone: ['emergencyphone', 'emergencycontactphone'],
  medicalNotes: ['medicalnotes', 'medicalinformation', 'healthnotes'],
  discount: ['discount', 'recurringdiscount'],
  discountReason: ['discountreason'],
  guardianName: ['guardianname', 'parentname'],
  guardianRelationship: ['guardianrelationship', 'relationship', 'parentrelationship'],
  guardianPhone: ['guardianphone', 'parentphone'],
  guardianEmail: ['guardianemail', 'parentemail'],
}

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const valueKey = (value: string) => value.trim().toLocaleLowerCase()
const phoneKey = (value: string) => value.replace(/\D/g, '')

function addContactName(map: Map<string, Set<string>>, contact: string, name: string) {
  if (!contact) return
  const names = map.get(contact) || new Set<string>()
  names.add(name)
  map.set(contact, names)
}

function mappedValue(record: Record<string, string>, field: keyof typeof headerAliases) {
  const aliases = headerAliases[field]
  const key = Object.keys(record).find(item => aliases.includes(headerKey(item)))
  return key ? record[key]?.trim() || '' : ''
}

export function csvRecordsToStudentInputs(rows: string[][]) {
  if (rows.length < 2) throw createError({ statusCode: 400, statusMessage: 'The CSV must contain a header and at least one student row' })
  const headers = rows[0]!.map(header => header.replace(/^\uFEFF/, '').trim())
  if (!headers.some(Boolean)) throw createError({ statusCode: 400, statusMessage: 'The CSV header row is empty' })

  return rows.slice(1).map((cells) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']))
    let firstName = mappedValue(record, 'firstName')
    let lastName = mappedValue(record, 'lastName')
    if (!firstName && !lastName) {
      const parts = mappedValue(record, 'fullName').split(/\s+/).filter(Boolean)
      firstName = parts.shift() || ''
      lastName = parts.join(' ')
    }
    return studentImportInputSchema.parse({
      firstName,
      lastName,
      ...Object.fromEntries(
        (Object.keys(studentImportInputSchema.shape) as Array<keyof StudentImportInput>)
          .filter(field => field !== 'firstName' && field !== 'lastName')
          .map(field => [field, mappedValue(record, field)])
      ),
    })
  })
}

function normalizedDate(value: string, label: string, errors: string[]) {
  if (!value) return undefined
  let normalized = value.trim()
  const localMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (localMatch) normalized = `${localMatch[3]}-${localMatch[2]!.padStart(2, '0')}-${localMatch[1]!.padStart(2, '0')}`
  const date = new Date(`${normalized}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    errors.push(`${label} must use YYYY-MM-DD or DD/MM/YYYY`)
    return undefined
  }
  return normalized
}

function normalizedGender(value: string, errors: string[]) {
  if (!value) return undefined
  const gender = ({ m: 'male', male: 'male', f: 'female', female: 'female', other: 'other', o: 'other' } as const)[valueKey(value)]
  if (!gender) errors.push('Gender must be male, female, or other')
  return gender
}

function normalizedStatus(value: string, errors: string[]) {
  const status = valueKey(value || 'active')
  if (!['active', 'inactive', 'archived'].includes(status)) {
    errors.push('Status must be active, inactive, or archived')
    return 'active' as const
  }
  return status as 'active' | 'inactive' | 'archived'
}

export async function prepareStudentImportRows(actorUserId: number, organizationId: number, rawInputs: unknown[]) {
  const inputs = rawInputs.map(input => studentImportInputSchema.parse(input))
  const accessibleDojoIds = await getAccessibleDojoIds(actorUserId, organizationId)
  const [allDojos, programs, ranks, feePlans, existingStudents, subscription] = await Promise.all([
    db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, organizationId) }),
    db.query.organizationPrograms.findMany({ where: eq(tables.organizationPrograms.organizationId, organizationId) }),
    db.query.beltRanks.findMany({ with: { system: true } }),
    db.query.feePlans.findMany({ where: eq(tables.feePlans.organizationId, organizationId) }),
    db.query.students.findMany({ where: eq(tables.students.organizationId, organizationId) }),
    getSubscriptionUsage(organizationId),
  ])
  const dojos = accessibleDojoIds === null ? allDojos : allDojos.filter(dojo => accessibleDojoIds.includes(dojo.id))
  const organizationRanks = ranks.filter(rank => rank.system.organizationId === organizationId)
  const existingEmails = new Map<string, Set<string>>()
  const existingPhones = new Map<string, Set<string>>()
  for (const student of existingStudents) {
    const name = valueKey(`${student.firstName} ${student.lastName}`)
    addContactName(existingEmails, valueKey(student.email || ''), name)
    addContactName(existingPhones, phoneKey(student.phone || ''), name)
  }
  const existingIdentities = new Set(existingStudents.map(student => `${valueKey(`${student.firstName} ${student.lastName}`)}|${student.dateOfBirth?.toISOString().slice(0, 10) || ''}`))
  const batchEmails = new Map<string, Set<string>>()
  const batchPhones = new Map<string, Set<string>>()
  const batchIdentities = new Set<string>()
  let capacity = subscription.limits.students === null ? Number.POSITIVE_INFINITY : Math.max(subscription.limits.students - subscription.usage.students, 0)

  const rows = []
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index]!
    const errors: string[] = []
    const warnings: string[] = []
    const dateOfBirth = normalizedDate(input.dateOfBirth, 'Date of birth', errors)
    const joinedAt = normalizedDate(input.joinedAt, 'Joined date', errors)
    const gender = normalizedGender(input.gender, errors)
    const status = normalizedStatus(input.status, errors)
    if (!input.firstName) errors.push('First name is required')
    if (!input.lastName) errors.push('Last name is required')
    if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) errors.push('Email address is invalid')
    if (input.countryCode && !/^[A-Za-z]{2}$/.test(input.countryCode)) errors.push('Country code must contain two letters')

    let dojo = dojos.find(item => valueKey(item.name) === valueKey(input.dojo))
    if (!dojo && !input.dojo && dojos.length === 1) {
      dojo = dojos[0]
      warnings.push(`Using the only available dojo: ${dojo!.name}`)
    }
    if (!dojo) errors.push(input.dojo ? `Unknown or inaccessible dojo "${input.dojo}"` : 'Dojo is required')

    let program = programs.find(item => valueKey(item.displayName) === valueKey(input.program))
    if (!program && input.program) errors.push(`Unknown program "${input.program}"`)
    if (!program && !input.program) {
      program = programs.find(item => item.isPrimary !== 0) || (programs.length === 1 ? programs[0] : undefined)
      if (program) warnings.push(`Using the primary program: ${program.displayName}`)
    }

    const belt = organizationRanks.find(item => valueKey(item.name) === valueKey(input.currentBelt)
      && (!program || !item.system.programId || item.system.programId === program.id))
    if (!belt && input.currentBelt) errors.push(`Unknown belt or rank "${input.currentBelt}"${program ? ` for ${program.displayName}` : ''}`)

    let feePlan = feePlans.find(item => valueKey(item.name) === valueKey(input.feePlan)
      && (!dojo || !item.dojoId || item.dojoId === dojo.id))
    if (feePlan?.scopeNodeId && dojo && !await isDojoWithinHierarchyNode(organizationId, dojo.id, feePlan.scopeNodeId)) feePlan = undefined
    if (!feePlan && input.feePlan) errors.push(`Unknown fee plan "${input.feePlan}" for this dojo`)
    const defaultFeePlan = !input.feePlan && dojo?.defaultFeePlanId
      ? feePlans.find(item => item.id === dojo.defaultFeePlanId)
      : undefined

    const discountMajor = input.discount ? Number(input.discount.replaceAll(',', '')) : 0
    if (!Number.isFinite(discountMajor) || discountMajor < 0) errors.push('Discount must be a positive number')
    if (discountMajor > 0 && !input.discountReason) errors.push('A discount reason is required')
    if (discountMajor > 0 && !feePlan && !defaultFeePlan) errors.push('A discount requires a matching or default fee plan')
    if (input.guardianEmail && !/^\S+@\S+\.\S+$/.test(input.guardianEmail)) errors.push('Guardian email address is invalid')
    if (input.guardianName && !input.guardianRelationship) errors.push('Guardian relationship is required when guardian name is provided')
    if (!input.guardianName && (input.guardianRelationship || input.guardianPhone || input.guardianEmail)) errors.push('Guardian name is required when guardian details are provided')

    const email = valueKey(input.email)
    const phone = phoneKey(input.phone)
    const studentName = valueKey(`${input.firstName} ${input.lastName}`)
    const identity = `${studentName}|${dateOfBirth || ''}`
    const emailNames = new Set([...(existingEmails.get(email) || []), ...(batchEmails.get(email) || [])])
    const phoneNames = new Set([...(existingPhones.get(phone) || []), ...(batchPhones.get(phone) || [])])
    if (email && emailNames.has(studentName)) errors.push('A student with this name and email already exists or appears earlier in this file')
    else if (email && emailNames.size) warnings.push('This email is already used by another student and will be treated as a shared family contact')
    if (phone && phoneNames.has(studentName)) errors.push('A student with this name and phone already exists or appears earlier in this file')
    else if (phone && phoneNames.size) warnings.push('This phone is already used by another student and will be treated as a shared family contact')
    if (dateOfBirth && (existingIdentities.has(identity) || batchIdentities.has(identity))) errors.push('A student with this name and date of birth already exists or appears earlier in this file')

    if (!errors.length && capacity <= 0) errors.push(`The ${subscription.plan} plan student limit would be exceeded`)
    if (!errors.length) {
      addContactName(batchEmails, email, studentName)
      addContactName(batchPhones, phone, studentName)
      if (dateOfBirth) batchIdentities.add(identity)
      capacity--
    }

    const payload: CreateStudentInput | null = dojo ? {
      dojoId: dojo.id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      dateOfBirth: dateOfBirth || null,
      joinedAt,
      gender: gender || null,
      address: input.address || null,
      city: input.city || null,
      stateProvince: input.stateProvince || null,
      country: input.country || null,
      countryCode: input.countryCode || null,
      postalCode: input.postalCode || null,
      emergencyContact: input.emergencyContact || null,
      emergencyPhone: input.emergencyPhone || null,
      medicalNotes: input.medicalNotes || null,
      status,
      programId: program?.id || null,
      currentBeltRankId: belt?.id || null,
      feePlanId: feePlan?.id,
      autoAssignDefaultFeePlan: !input.feePlan,
      initialDiscount: Number.isFinite(discountMajor) && discountMajor > 0 ? Math.round(discountMajor * 100) : 0,
      discountReason: input.discountReason || undefined,
      guardian: input.guardianName ? {
        name: input.guardianName,
        relationship: input.guardianRelationship,
        phone: input.guardianPhone || null,
        email: input.guardianEmail || null,
      } : undefined,
    } : null

    rows.push({
      rowNumber: index + 2,
      input,
      resolved: {
        dojo: dojo?.name || input.dojo,
        program: program?.displayName || input.program,
        belt: belt?.name || input.currentBelt,
        feePlan: feePlan?.name || defaultFeePlan?.name || (input.feePlan || 'No fee plan'),
      },
      payload,
      errors,
      warnings,
      valid: errors.length === 0 && payload !== null,
    })
  }
  return rows
}
