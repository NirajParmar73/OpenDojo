import { timingSafeEqual } from 'node:crypto'
import { and, gt, isNull, lte, or } from 'drizzle-orm'
import { db, tables } from '../../../utils/database'
import { dispatchAnnouncementPush } from '../../../utils/student-push'
import { reconcileStudentFeeNotifications } from '../../../utils/student-notifications'

function secretsMatch(provided: string, expected: string) {
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = String(config.notificationCronSecret || '')
  const authorization = getRequestHeader(event, 'authorization') || ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Notification scheduler is not configured' })
  if (!provided || !secretsMatch(provided, secret)) throw createError({ statusCode: 401, statusMessage: 'Invalid scheduler credentials' })

  const now = new Date()
  const recipients = await db.selectDistinct({
    studentId: tables.studentPushSubscriptions.studentId,
    organizationId: tables.studentPushSubscriptions.organizationId,
  }).from(tables.studentPushSubscriptions)

  let feeRecipientsProcessed = 0
  let feeRecipientFailures = 0
  for (let offset = 0; offset < recipients.length; offset += 10) {
    const batch = recipients.slice(offset, offset + 10)
    const outcomes = await Promise.allSettled(batch.map(recipient => reconcileStudentFeeNotifications(
      recipient.studentId,
      recipient.organizationId,
      now,
    )))
    feeRecipientsProcessed += outcomes.filter(result => result.status === 'fulfilled').length
    feeRecipientFailures += outcomes.filter(result => result.status === 'rejected').length
  }

  const dueAnnouncements = await db.query.announcements.findMany({
    where: and(
      isNull(tables.announcements.pushSentAt),
      lte(tables.announcements.publishedAt, now),
      or(isNull(tables.announcements.expiresAt), gt(tables.announcements.expiresAt, now)),
    ),
  })
  let announcementsDispatched = 0
  let announcementFailures = 0
  for (const announcement of dueAnnouncements) {
    try {
      const result = await dispatchAnnouncementPush(announcement, now)
      if (result.configured) announcementsDispatched += 1
    } catch (error) {
      announcementFailures += 1
      console.error('Scheduled announcement push dispatch failed.', error)
    }
  }

  return {
    success: feeRecipientFailures === 0 && announcementFailures === 0,
    feeRecipientsProcessed,
    feeRecipientFailures,
    announcementsDispatched,
    announcementFailures,
  }
})
