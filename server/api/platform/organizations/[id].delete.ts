import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { writePlatformAuditLog } from '../../../utils/platform-audit'
import { requirePlatformAdmin } from '../../../utils/platform-admin'
import { removeTenantUploads } from '../../../utils/tenant-files'

const bodySchema = z.object({ confirmation: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const session = await requirePlatformAdmin(event)
  const organizationId = z.coerce.number().int().positive().parse(getRouterParam(event, 'id'))
  const { confirmation } = await readValidatedBody(event, bodySchema.parse)
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId) })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
  if (confirmation.trim() !== organization.slug) throw createError({ statusCode: 400, statusMessage: 'Type the exact workspace slug to permanently delete it' })

  const [users, students, documents, gradings, achievements, affiliations, expenses, qualifications] = await Promise.all([
    db.query.users.findMany({ where: eq(tables.users.organizationId, organizationId), columns: { avatar: true, certificateUrl: true } }),
    db.query.students.findMany({ where: eq(tables.students.organizationId, organizationId), columns: { avatar: true, certificateUrl: true } }),
    db.query.documents.findMany({ where: eq(tables.documents.organizationId, organizationId), columns: { fileUrl: true } }),
    db.query.studentGradings.findMany({ columns: { certificateUrl: true }, with: { student: { columns: { organizationId: true } } } }),
    db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.organizationId, organizationId), columns: { certificateUrl: true } }),
    db.query.affiliations.findMany({ where: eq(tables.affiliations.organizationId, organizationId), columns: { documentUrl: true } }),
    db.query.expenses.findMany({ where: eq(tables.expenses.organizationId, organizationId), columns: { receiptUrl: true } }),
    db.query.instructorQualifications.findMany({ where: eq(tables.instructorQualifications.organizationId, organizationId), columns: { certificateUrl: true } }),
  ])
  const files = [organization.logo, ...users.flatMap(row => [row.avatar, row.certificateUrl]), ...students.flatMap(row => [row.avatar, row.certificateUrl]), ...documents.map(row => row.fileUrl), ...gradings.filter(row => row.student.organizationId === organizationId).map(row => row.certificateUrl), ...achievements.map(row => row.certificateUrl), ...affiliations.map(row => row.documentUrl), ...expenses.map(row => row.receiptUrl), ...qualifications.map(row => row.certificateUrl)]

  // Write the platform audit entry first. If the operator belongs to the
  // tenant being deleted, its foreign key changes actorUserId to NULL during
  // the cascade while the record itself remains available to the platform.
  await db.transaction(async (tx) => {
    await tx.insert(tables.platformAuditLogs).values({ actorUserId: session.user.id, action: 'organization_permanently_deleted', organizationId, organizationName: organization.name, details: `Workspace ${organization.slug} and its tenant data were permanently deleted by the platform administrator.` })
    // Database foreign keys cascade all tenant-owned rows, including the owner.
    await tx.delete(tables.organizations).where(eq(tables.organizations.id, organizationId))
  })
  const uploadFailures = await removeTenantUploads(files)
  return { success: true, uploadFailures }
})
