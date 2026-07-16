import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'

const schema = z.object({ username: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, underscores, or hyphens'), temporaryPassword: z.string().min(8).max(128), isActive: z.boolean().default(true) })

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId || !['owner', 'admin'].includes(session.user.role)) throw createError({ statusCode: 403, statusMessage: 'Only administrators can manage portal access' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const body = await readValidatedBody(event, schema.parse)
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const existingUsername = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.username, body.username) })
  const account = await db.query.studentPortalAccounts.findFirst({ where: eq(tables.studentPortalAccounts.studentId, studentId) })
  if (existingUsername && existingUsername.id !== account?.id) throw createError({ statusCode: 409, statusMessage: 'That portal username is already in use' })
  const values = { username: body.username, passwordHash: await hashPassword(body.temporaryPassword), isActive: body.isActive ? 1 : 0, updatedAt: new Date() }
  if (account) await db.update(tables.studentPortalAccounts).set(values).where(eq(tables.studentPortalAccounts.id, account.id))
  else await db.insert(tables.studentPortalAccounts).values({ studentId, ...values })
  return { success: true }
})
