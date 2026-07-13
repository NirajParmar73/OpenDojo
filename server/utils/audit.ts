import { db, tables } from './database'

type AuditScope = { type: 'organization', id?: null } | { type: 'node' | 'dojo', id: number }

export async function writeAuditLog(input: {
  organizationId: number
  actorUserId?: number | null
  action: string
  entityType: string
  entityId?: number | null
  targetLabel: string
  scope: AuditScope
  details?: string | null
}) {
  await db.insert(tables.auditLogs).values({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId || null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId || null,
    targetLabel: input.targetLabel,
    scopeType: input.scope.type,
    scopeId: input.scope.type === 'organization' ? null : input.scope.id,
    details: input.details || null,
  })
}
