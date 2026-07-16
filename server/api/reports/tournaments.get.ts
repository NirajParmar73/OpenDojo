import { eq } from 'drizzle-orm'
import { db, tables } from '../../utils/database'
import { getAccessibleDojoIds } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const accessible = await getAccessibleDojoIds(session.user.id, session.user.organizationId)
  const achievements = await db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.organizationId, session.user.organizationId), with: { student: true, tournament: true } })
  const visible = achievements.filter(item => item.tournamentId && (accessible === null || (item.student.dojoId !== null && accessible.includes(item.student.dojoId))))
  const tournaments = new Map<number, { id: number, name: string, level: string, venue: string | null, startDate: Date, ageCutoffDate: Date | null, participantIds: Set<number> }>()
  for (const item of visible) if (item.tournament) {
    const current = tournaments.get(item.tournament.id) || { id: item.tournament.id, name: item.tournament.name, level: item.tournament.level, venue: item.tournament.venue, startDate: item.tournament.startDate, ageCutoffDate: item.tournament.ageCutoffDate, participantIds: new Set<number>() }
    current.participantIds.add(item.studentId)
    tournaments.set(item.tournament.id, current)
  }
  return [...tournaments.values()]
    .map(({ participantIds, ...tournament }) => ({ ...tournament, participants: participantIds.size }))
    .sort((a, b) => Number(b.startDate) - Number(a.startDate))
})
