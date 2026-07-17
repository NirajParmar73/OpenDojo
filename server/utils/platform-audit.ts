import { db, tables } from './database'

export async function writePlatformAuditLog(input: {
  actorUserId: number | null | undefined
  action: string
  organizationId: number
  organizationName: string
  details?: string
}) {
  await db.insert(tables.platformAuditLogs).values({
    actorUserId: input.actorUserId || null,
    action: input.action,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    details: input.details || null,
  })
}
