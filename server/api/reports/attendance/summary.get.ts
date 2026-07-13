import { z } from 'zod'
import { db, tables } from '../../../utils/database'
import { eq } from 'drizzle-orm'
import { getAccessibleDojoIds, getHierarchyManagementScope } from '../../../utils/permissions'

const querySchema = z.object({ dojoId: z.coerce.number().int().positive().optional(), nodeId: z.coerce.number().int().positive().optional(), from: z.string().optional(), to: z.string().optional() })
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const query = querySchema.parse(getQuery(event))
  const accessible = await getAccessibleDojoIds(session.user.id, session.user.organizationId)
  const managementScope = await getHierarchyManagementScope(session.user.id, session.user.organizationId)
  if (query.dojoId && accessible !== null && !accessible.includes(query.dojoId)) throw createError({ statusCode: 403, statusMessage: 'Report scope is not accessible' })
  const allNodes = await db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, session.user.organizationId) })
  const selectedNodeIds = new Set<number>()
  if (query.nodeId) {
    if (accessible !== null && !managementScope.managedParentNodeIds.includes(query.nodeId)) {
      throw createError({ statusCode: 403, statusMessage: 'Report scope is not accessible' })
    }
    const pending = [query.nodeId]
    while (pending.length) {
      const nodeId = pending.pop()!
      if (selectedNodeIds.has(nodeId)) continue
      selectedNodeIds.add(nodeId)
      for (const node of allNodes) if (node.parentId === nodeId) pending.push(node.id)
    }
    const scopedDojos = await db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, session.user.organizationId) })
    const selectedDojoIds = scopedDojos.filter(dojo => selectedNodeIds.has(dojo.nodeId)).map(dojo => dojo.id)
    if (accessible !== null && selectedDojoIds.some(id => !accessible.includes(id))) throw createError({ statusCode: 403, statusMessage: 'Report scope is not accessible' })
    query.dojoId = undefined
    ;(query as any).selectedDojoIds = selectedDojoIds
  }
  const records = await db.query.attendance.findMany({ with: { session: true, student: true } })
  const from = query.from ? new Date(`${query.from}T00:00:00`) : null
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : null
  const selectedDojoIds = (query as any).selectedDojoIds as number[] | undefined
  const filtered = records.filter(record => record.student.organizationId === session.user.organizationId && (!accessible || accessible.includes(record.session.dojoId)) && (!query.dojoId || record.session.dojoId === query.dojoId) && (!selectedDojoIds || selectedDojoIds.includes(record.session.dojoId)) && (!from || record.session.date >= from) && (!to || record.session.date <= to))
  const counts = { present: 0, absent: 0, late: 0, excused: 0 }
  for (const record of filtered) counts[record.status]++
  return { total: filtered.length, ...counts, attendanceRate: filtered.length ? Math.round(((counts.present + counts.late) / filtered.length) * 100) : 0 }
})
