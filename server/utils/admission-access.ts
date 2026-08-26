import { and, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { hasStudentPortalManagementAccess } from './permissions'

export async function requireAdmissionApplication(event: any, id: number) {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const user = session.user
  const application = await db.query.admissionApplications.findFirst({
    where: and(eq(tables.admissionApplications.id, id), eq(tables.admissionApplications.organizationId, session.user.organizationId)),
    with: { organization: true, dojo: true, program: true, reviewer: { columns: { id: true, name: true } }, physicalCopyReceiver: { columns: { id: true, name: true } }, resultingStudent: true },
  }) as any
  if (!application) throw createError({ statusCode: 404, statusMessage: 'Admission application not found' })
  if (!await hasStudentPortalManagementAccess(user.id, user.organizationId!, application.dojoId)) throw createError({ statusCode: 403, statusMessage: 'You cannot manage admissions for this dojo' })
  return { user, application }
}
