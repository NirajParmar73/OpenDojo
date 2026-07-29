import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { writeAuditLog } from '../../utils/audit'
import { db, tables } from '../../utils/database'

const schema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long').max(128),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number((session?.user as unknown as Record<string, unknown>)?.studentId)
  if (!studentId || session?.user?.role !== 'student' || !session.user.organizationId) {
    throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  }

  const body = await readValidatedBody(event, schema.parse)
  const account = await db.query.studentPortalAccounts.findFirst({
    where: and(eq(tables.studentPortalAccounts.id, session.user.id), eq(tables.studentPortalAccounts.studentId, studentId)),
  })
  if (!account || !account.isActive) throw createError({ statusCode: 404, statusMessage: 'Portal account not found' })
  if (!await verifyPassword(account.passwordHash, body.currentPassword)) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }
  if (await verifyPassword(account.passwordHash, body.newPassword)) {
    throw createError({ statusCode: 400, statusMessage: 'New password must be different from the current password' })
  }

  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)),
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })

  await db.update(tables.studentPortalAccounts)
    .set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() })
    .where(eq(tables.studentPortalAccounts.id, account.id))

  await writeAuditLog({
    organizationId: session.user.organizationId,
    action: 'student.portal_password.changed',
    entityType: 'student',
    entityId: student.id,
    targetLabel: `${student.firstName} ${student.lastName}`,
    scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
    details: 'Password changed by the student',
  })

  return { success: true }
})
