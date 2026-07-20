import { db, tables } from '../../utils/database'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { getAccessibleDojoIds, getAccessibleFeePlanScopeNodeIds } from '../../utils/permissions'

const territoryManagerRoles = new Set(['country_head', 'state_head', 'district_head', 'city_head', 'zone_head', 'dojo_head'])

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const accessibleDojos = await getAccessibleDojoIds(session.user.id, orgId)
  const accessibleScopeNodes = await getAccessibleFeePlanScopeNodeIds(session.user.id, orgId)
  const assignments = accessibleDojos !== null && !accessibleDojos.length
    ? await db.query.assignments.findMany({ where: eq(tables.assignments.userId, session.user.id) })
    : []
  const managesTerritory = assignments.some(assignment => territoryManagerRoles.has(assignment.role))

  // A newly assigned hierarchy head may not have a dojo below their node yet.
  // They can still use organization-wide plans, while unassigned users receive
  // no plans at all.
  if (accessibleDojos !== null && !accessibleDojos.length && !managesTerritory) return []

  const feePlans = await db.query.feePlans.findMany({
    where: accessibleDojos === null
      ? eq(tables.feePlans.organizationId, orgId)
      : and(
          eq(tables.feePlans.organizationId, orgId),
          or(
            and(isNull(tables.feePlans.dojoId), isNull(tables.feePlans.scopeNodeId)),
            ...(accessibleDojos.length ? [inArray(tables.feePlans.dojoId, accessibleDojos)] : []),
            ...(accessibleScopeNodes?.length ? [inArray(tables.feePlans.scopeNodeId, accessibleScopeNodes)] : [])
          )
        ),
    with: {
      dojo: true,
      scopeNode: true,
    },
    orderBy: (plans, { asc }) => [asc(plans.name)]
  })

  return feePlans
})
