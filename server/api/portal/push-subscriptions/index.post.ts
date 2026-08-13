import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { requireStudentPushRecipient } from '../../../utils/student-push'

const schema = z.object({
  endpoint: z.string().url().max(4096).refine(value => value.startsWith('https://'), 'A secure push endpoint is required'),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256),
  }),
})

export default defineEventHandler(async (event) => {
  const { studentId, organizationId } = await requireStudentPushRecipient(event)
  const body = await readValidatedBody(event, schema.parse)
  const now = new Date()
  await db.insert(tables.studentPushSubscriptions).values({
    organizationId,
    studentId,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 500),
    updatedAt: now,
  }).onConflictDoUpdate({
    target: tables.studentPushSubscriptions.endpoint,
    set: {
      organizationId,
      studentId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 500),
      updatedAt: now,
    },
  })
  return { success: true }
})
