import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { requireStudentPushRecipient } from '../../../utils/student-push'

const schema = z.object({ endpoint: z.string().url().max(4096) })

export default defineEventHandler(async (event) => {
  const { studentId, organizationId } = await requireStudentPushRecipient(event)
  const body = await readValidatedBody(event, schema.parse)
  await db.delete(tables.studentPushSubscriptions).where(and(
    eq(tables.studentPushSubscriptions.endpoint, body.endpoint),
    eq(tables.studentPushSubscriptions.studentId, studentId),
    eq(tables.studentPushSubscriptions.organizationId, organizationId),
  ))
  return { success: true }
})
