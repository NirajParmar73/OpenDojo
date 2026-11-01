import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'

export async function tournamentStaff(http: H3Event, manager = false) {
  const session = await getUserSession(http)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (session.user.role === 'student' || (manager && !['owner', 'admin'].includes(session.user.role))) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization administrators can manage tournament registration' })
  }
  return session.user as typeof session.user & { organizationId: number }
}

export async function staffTournament(organizationId: number, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })
  const tournament = await db.query.tournaments.findFirst({ where: and(eq(tables.tournaments.id, id), eq(tables.tournaments.organizationId, organizationId)) })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
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
