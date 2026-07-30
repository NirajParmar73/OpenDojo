import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { writeAuditLog } from '../../../utils/audit'
import { hasStudentPortalManagementAccess } from '../../../utils/permissions'

const schema = z.object({ username: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, underscores, or hyphens'), temporaryPassword: z.string().min(8).max(128), isActive: z.boolean().default(true) })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const body = await readValidatedBody(event, schema.parse)
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (!await hasStudentPortalManagementAccess(session.user.id, session.user.organizationId, student.dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'You can manage portal access only for students in your assigned locations' })
  }
  const existingUsername = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.username, body.username) })
  const account = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.studentId, studentId) })
  if (existingUsername && existingUsername.id !== account?.id) throw createError({ statusCode: 409, statusMessage: 'That portal username is already in use' })
  const values = { username: body.username, passwordHash: await hashPassword(body.temporaryPassword), isActive: body.isActive ? 1 : 0, mustChangePassword: true, updatedAt: new Date() }
  if (account) await db.update(tables.studentPortalAccounts).set(values).where(eq(tables.studentPortalAccounts.id, account.id))
  else await db.insert(tables.studentPortalAccounts).values({ studentId, ...values })
  await writeAuditLog({
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    action: account ? 'student.portal_access.reset' : 'student.portal_access.created',
    entityType: 'student',
    entityId: student.id,
    targetLabel: `${student.firstName} ${student.lastName}`,
    scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
    details: body.isActive ? 'Portal access is active' : 'Portal access is inactive',
  })
  return { success: true }
})
