import { z } from 'zod'
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { currentTenant } from '../../utils/tenant'

const schema = z.object({ username: z.string().trim().min(3).max(100), password: z.string().min(8) })
type PortalAccount = { id: number, studentId: number, passwordHash: string, isActive: number, student: { firstName: string, lastName: string, organizationId: number, dojo: { name: string } | null } | null }

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const account = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.username, body.username), with: { student: { with: { dojo: true } } } }) as unknown as PortalAccount | undefined
  if (!account || !account.student || !account.isActive || !await verifyPassword(account.passwordHash, body.password)) throw createError({ statusCode: 401, statusMessage: 'Invalid portal credentials' })
  const tenant = currentTenant(event)
  if (tenant && tenant.id !== account.student.organizationId) throw createError({ statusCode: 403, statusMessage: 'Use your organization workspace address to sign in' })
  const session = { user: { id: account.id, name: `${account.student.firstName} ${account.student.lastName}`, role: 'student', organizationId: account.student.organizationId, studentId: account.studentId, organizationName: account.student.dojo?.name || 'Student portal' }, lastLoggedIn: new Date() }
  await setUserSession(event, session as never)
  return { success: true }
})
