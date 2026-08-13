import webpush from 'web-push'
import type { H3Event } from 'h3'
import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { db, tables } from './database'

export type StudentPushPayload = {
  title: string
  body: string
  url: string
  tag: string
}

type PushResult = {
  configured: boolean
  subscriptions: number
  delivered: number
  failed: number
}

function pushConfiguration() {
  const config = useRuntimeConfig()
  const publicKey = String(config.public.webPushPublicKey || '')
  const privateKey = String(config.webPushPrivateKey || '')
  const subject = String(config.webPushSubject || '')
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && subject) }
}

export async function requireStudentPushRecipient(event: H3Event) {
  const session = await getUserSession(event)
  const user = session?.user
  const studentId = Number((user as unknown as Record<string, unknown> | undefined)?.studentId)
  const organizationId = Number(user?.organizationId)
  if (!studentId || !organizationId || user?.role !== 'student') {
    throw createError({ statusCode: 403, statusMessage: 'Student portal access required' })
  }
  return { studentId, organizationId }
}

export async function sendPushToStudents(studentIds: number[], payload: StudentPushPayload): Promise<PushResult> {
  const recipientIds = [...new Set(studentIds.filter(Number.isInteger))]
  const vapid = pushConfiguration()
  if (!vapid.configured || !recipientIds.length) {
    return { configured: vapid.configured, subscriptions: 0, delivered: 0, failed: 0 }
  }

  const subscriptions = await db.query.studentPushSubscriptions.findMany({
    where: inArray(tables.studentPushSubscriptions.studentId, recipientIds),
  })
  const staleEndpoints: string[] = []
  let delivered = 0
  let failed = 0
  const notification = JSON.stringify({
    title: payload.title.slice(0, 160),
    body: payload.body.slice(0, 500),
    url: payload.url.startsWith('/portal') ? payload.url : '/portal',
    tag: payload.tag.slice(0, 120),
  })

  for (let offset = 0; offset < subscriptions.length; offset += 50) {
    const batch = subscriptions.slice(offset, offset + 50)
    await Promise.all(batch.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, notification, {
          TTL: 24 * 60 * 60,
          urgency: 'high',
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
        })
        delivered += 1
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number }).statusCode)
        if (statusCode === 404 || statusCode === 410) staleEndpoints.push(subscription.endpoint)
        failed += 1
        console.warn('Student push notification delivery failed.', { statusCode: statusCode || undefined })
      }
    }))
  }

  if (staleEndpoints.length) {
    await db.delete(tables.studentPushSubscriptions)
      .where(inArray(tables.studentPushSubscriptions.endpoint, staleEndpoints))
  }
  return { configured: true, subscriptions: subscriptions.length, delivered, failed }
}

type PushAnnouncement = {
  id: number
  organizationId: number
  dojoId: number | null
  scopeNodeId: number | null
  title: string
  message: string
  severity: 'info' | 'success' | 'warning' | 'urgent'
  publishedAt: Date
  expiresAt: Date | null
}

async function announcementStudentIds(announcement: PushAnnouncement) {
  let dojoIds: number[] | null = null
  if (announcement.dojoId) {
    dojoIds = [announcement.dojoId]
  } else if (announcement.scopeNodeId) {
    const nodes = await db.query.hierarchyNodes.findMany({
      where: eq(tables.hierarchyNodes.organizationId, announcement.organizationId),
      columns: { id: true, parentId: true },
    })
    const descendantIds = new Set([announcement.scopeNodeId])
    let changed = true
    while (changed) {
      changed = false
      for (const node of nodes) {
        if (node.parentId && descendantIds.has(node.parentId) && !descendantIds.has(node.id)) {
          descendantIds.add(node.id)
          changed = true
        }
      }
    }
    const dojos = await db.query.dojos.findMany({
      where: and(
        eq(tables.dojos.organizationId, announcement.organizationId),
        inArray(tables.dojos.nodeId, [...descendantIds]),
      ),
      columns: { id: true },
    })
    dojoIds = dojos.map(dojo => dojo.id)
  }

  if (dojoIds && !dojoIds.length) return []
  const students = await db.query.students.findMany({
    where: and(
      eq(tables.students.organizationId, announcement.organizationId),
      or(isNull(tables.students.status), ne(tables.students.status, 'archived')),
      ...(dojoIds ? [inArray(tables.students.dojoId, dojoIds)] : []),
    ),
    columns: { id: true },
  })
  return students.map(student => student.id)
}

export async function dispatchAnnouncementPush(announcement: PushAnnouncement, now = new Date()) {
  if (announcement.publishedAt > now || (announcement.expiresAt && announcement.expiresAt <= now)) {
    return { configured: false, subscriptions: 0, delivered: 0, failed: 0 }
  }
  const studentIds = await announcementStudentIds(announcement)
  const result = await sendPushToStudents(studentIds, {
    title: announcement.title,
    body: announcement.message,
    url: '/portal',
    tag: `announcement-${announcement.id}`,
  })
  if (result.configured) {
    await db.update(tables.announcements)
      .set({ pushSentAt: now, updatedAt: now })
      .where(eq(tables.announcements.id, announcement.id))
  }
  return result
}
