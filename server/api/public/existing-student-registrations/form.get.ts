import { eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { getAdmissionForm, resolveAdmissionOrganization } from '../../../utils/admissions'

export default defineEventHandler(async (event) => {
  const organization = await resolveAdmissionOrganization(event)
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization registration form not found' })
  const form = await getAdmissionForm(organization.id)
  if (!form.isExistingRegistrationPublished) throw createError({ statusCode: 404, statusMessage: 'Existing student registration is not currently open' })
  const [dojos, programs, beltSystems] = await Promise.all([
    db.query.dojos.findMany({
      where: eq(tables.dojos.organizationId, organization.id),
      columns: { id: true, name: true, city: true, stateProvince: true, country: true },
      with: { schedules: { columns: { id: true, dayOfWeek: true, startTime: true, endTime: true, name: true }, orderBy: (schedule, { asc }) => [asc(schedule.dayOfWeek), asc(schedule.startTime)] } },
    }),
    db.query.organizationPrograms.findMany({ where: eq(tables.organizationPrograms.organizationId, organization.id), columns: { id: true, displayName: true, isActive: true } }),
    db.query.beltSystems.findMany({ where: eq(tables.beltSystems.organizationId, organization.id), with: { ranks: true } }),
  ])
  return {
    organization: { name: organization.name, slug: organization.slug, logo: organization.logo },
    form: { title: form.existingRegistrationTitle, introduction: form.existingRegistrationIntroduction, privacyNotice: form.privacyNotice, consentText: form.existingRegistrationConsentText },
    dojos,
    programs: programs.filter(program => program.isActive),
    beltRanks: beltSystems.flatMap(system => system.ranks.map(rank => ({ id: rank.id, name: rank.name, order: rank.order, programId: system.programId }))).sort((a, b) => a.order - b.order),
  }
})
