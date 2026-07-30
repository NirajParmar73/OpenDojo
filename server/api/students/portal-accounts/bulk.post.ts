import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { writeAuditLog } from '../../../utils/audit'
import { db, tables } from '../../../utils/database'
import { hasStudentPortalManagementAccess } from '../../../utils/permissions'
import { generateTemporaryPassword, studentPortalUsername, type PortalCredentials } from '../../../utils/student-portal'

const schema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1).max(200).transform(ids => [...new Set(ids)]),
  action: z.enum(['grant', 'activate', 'deactivate', 'reset']),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const actorUserId = session.user.id
  const organizationId = session.user.organizationId
  const body = await readValidatedBody(event, schema.parse)
  const students = await db.query.students.findMany({
    where: and(
      eq(tables.students.organizationId, organizationId),
      inArray(tables.students.id, body.studentIds),
    ),
  })
  if (students.length !== body.studentIds.length) {
    throw createError({ statusCode: 404, statusMessage: 'One or more students could not be found' })
  }
  const accessChecks = await Promise.all(students.map(student =>
    hasStudentPortalManagementAccess(actorUserId, organizationId, student.dojoId)
  ))
  if (accessChecks.some(allowed => !allowed)) {
    throw createError({ statusCode: 403, statusMessage: 'You can manage portal access only for students in your assigned locations' })
  }

  const accounts = await db.query.studentPortalAccounts.findMany({
    where: inArray(tables.studentPortalAccounts.studentId, body.studentIds),
  })
  const accountsByStudent = new Map(accounts.map(account => [account.studentId, account]))
  const credentials: PortalCredentials[] = []
  let created = 0
  let updated = 0

  for (const student of students) {
    const account = accountsByStudent.get(student.id)
    if (body.action === 'deactivate' || body.action === 'activate') {
      if (account) {
        await db.update(tables.studentPortalAccounts)
          .set({ isActive: body.action === 'activate' ? 1 : 0, updatedAt: new Date() })
          .where(eq(tables.studentPortalAccounts.id, account.id))
        updated++
      }
    } else if (account && body.action === 'grant') {
      if (!account.isActive) {
        await db.update(tables.studentPortalAccounts)
          .set({ isActive: 1, updatedAt: new Date() })
          .where(eq(tables.studentPortalAccounts.id, account.id))
        updated++
      }
    } else {
      const temporaryPassword = generateTemporaryPassword()
      const username = account?.username || studentPortalUsername(student.firstName, student.lastName, student.id)
      const values = {
        username,
        passwordHash: await hashPassword(temporaryPassword),
        isActive: 1,
        mustChangePassword: true,
        updatedAt: new Date(),
      }
      if (account) {
        await db.update(tables.studentPortalAccounts).set(values).where(eq(tables.studentPortalAccounts.id, account.id))
        updated++
      } else {
        await db.insert(tables.studentPortalAccounts).values({ studentId: student.id, ...values })
        created++
      }
      credentials.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        username,
        temporaryPassword,
      })
    }

    await writeAuditLog({
      organizationId,
      actorUserId,
      action: `student.portal_access.bulk_${body.action}`,
      entityType: 'student',
      entityId: student.id,
      targetLabel: `${student.firstName} ${student.lastName}`,
      scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
      details: `Bulk portal access action: ${body.action}`,
    })
  }

  return {
    success: true,
    action: body.action,
    affected: students.length,
    created,
    updated,
    credentials,
  }
})
