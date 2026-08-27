import { eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { getAdmissionForm, resolveAdmissionOrganization } from '../../../utils/admissions'

export default defineEventHandler(async (event) => {
  const organization = await resolveAdmissionOrganization(event)
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization admission form not found' })
  const form = await getAdmissionForm(organization.id)
  if (!form.isPublished) throw createError({ statusCode: 404, statusMessage: 'This organization is not accepting online applications' })
  const [dojos, programs] = await Promise.all([
    db.query.dojos.findMany({
      where: eq(tables.dojos.organizationId, organization.id),
      columns: { id: true, name: true, city: true, stateProvince: true, country: true },
      with: {
        schedules: {
          columns: { id: true, dayOfWeek: true, startTime: true, endTime: true, name: true },
          orderBy: (schedule, { asc }) => [asc(schedule.dayOfWeek), asc(schedule.startTime)],
        },
      },
    }),
    db.query.organizationPrograms.findMany({ where: eq(tables.organizationPrograms.organizationId, organization.id), columns: { id: true, displayName: true, isActive: true } }),
  ])
  return {
    organization: { name: organization.name, slug: organization.slug, logo: organization.logo },
    form: { title: form.title, introduction: form.introduction, physicalCopyInstructions: form.physicalCopyInstructions, privacyNotice: form.privacyNotice, consentText: form.consentText, requirePhysicalCopy: form.requirePhysicalCopy },
    dojos,
    programs: programs.filter(program => program.isActive),
  }
})
