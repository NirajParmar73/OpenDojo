import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'
import { getAccessibleDojoIds } from './permissions'
import { canManageTournament, canViewTournament, tournamentManagerRoles } from '../../shared/utils/tournament-access'

export async function tournamentActor(userId: number, organizationId: number) {
  const user = await db.query.users.findFirst({ where: and(eq(tables.users.id, userId), eq(tables.users.organizationId, organizationId)) })
  if (!user || user.status !== 'active') throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const [accessible, locations, assignments, nodes] = await Promise.all([
    getAccessibleDojoIds(userId, organizationId),
    db.query.dojos.findMany({ where: eq(tables.dojos.organizationId, organizationId), columns: { id: true, name: true } }),
    db.query.assignments.findMany({ where: eq(tables.assignments.userId, userId) }),
    db.query.hierarchyNodes.findMany({ where: eq(tables.hierarchyNodes.organizationId, organizationId), columns: { id: true } }),
  ])
  const dojoIds = accessible === null ? null : locations.filter(location => accessible.includes(location.id)).map(location => location.id)
  const assignedManager = assignments.some(assignment => tournamentManagerRoles.includes(assignment.role) && (assignment.scopeType === 'dojo' ? locations.some(location => location.id === assignment.scopeId) : nodes.some(node => node.id === assignment.scopeId)))
  const manager = (tournamentManagerRoles.includes(user.role) || assignedManager) && (dojoIds === null || dojoIds.length > 0)
  return { id: userId, organizationId, role: user.role, dojoIds, manager, locations: locations.filter(location => dojoIds === null || dojoIds.includes(location.id)) }
}

export type TournamentActor = Awaited<ReturnType<typeof tournamentActor>>

export function tournamentCreationScope(actor: TournamentActor, requested?: number[]) {
  if (!actor.manager) throw createError({ statusCode: 403, statusMessage: 'A location manager or instructor needs an assigned location to create tournament forms' })
  const ids = [...new Set(requested ?? actor.dojoIds ?? [])].sort((a, b) => a - b)
  if ((actor.dojoIds !== null && !ids.length) || ids.some(id => !actor.locations.some(location => location.id === id))) {
    throw createError({ statusCode: 403, statusMessage: 'Select locations within your assigned scope. Only organization owners and admins can create organization-wide tournaments.' })
  }
  return ids
}

export async function tournamentStaff(http: H3Event, manager = false) {
  const session = await getUserSession(http)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role === 'student') throw createError({ statusCode: 403, statusMessage: 'Staff access is required' })
  const actor = await tournamentActor(session.user.id, session.user.organizationId)
  if (manager && !actor.manager) throw createError({ statusCode: 403, statusMessage: 'Tournament form creation requires a manager or instructor with an assigned location' })
  return { ...session.user, ...actor }
}

export async function staffTournament(organizationId: number, id: number, actor?: TournamentActor, manage = false) {
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })
  const tournament = await db.query.tournaments.findFirst({ where: and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, organizationId)) })
  if (!tournament || (actor && !canViewTournament(actor, tournament))) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  if (manage && (!actor || !canManageTournament(actor, tournament))) throw createError({ statusCode: 403, statusMessage: 'This tournament is outside your management scope' })
  return tournament
}

export async function publicTournament(http: H3Event, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw createError({ statusCode: 404, statusMessage: 'This participation form is unavailable' })
  const tournament = await db.query.tournaments.findFirst({ where: eq(tables.tournaments.registrationToken, token), with: { organization: true } })
  const tenant = http.context.tenant as { id: number } | undefined
  if (!tournament || (tenant && tenant.id !== tournament.organizationId) || tournament.organization.subscriptionStatus === 'suspended') {
    throw createError({ statusCode: 404, statusMessage: 'This participation form is unavailable' })
  }
  return tournament
}
