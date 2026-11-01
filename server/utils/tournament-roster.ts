import { and, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { staffTournament, tournamentActor } from './tournament-access'
import { canViewTournamentEntry } from '../../shared/utils/tournament-access'

export async function tournamentRoster(userId: number, organizationId: number, tournamentId: number) {
  const actor = await tournamentActor(userId, organizationId)
  const tournament = await staffTournament(organizationId, tournamentId, actor)
  const entries = await db.query.studentAchievements.findMany({
      where: and(eq(tables.studentAchievements.tournamentId, tournamentId), eq(tables.studentAchievements.organizationId, organizationId)),
      with: { participant: true, student: { with: { currentBeltRank: true } } },
      orderBy: (table, { asc }) => [asc(table.createdAt), asc(table.id)],
    })
  return entries.filter(entry => canViewTournamentEntry(actor, tournament, entry)).map(entry => ({
    ...entry,
    // Public form values are the participation snapshot, even for linked students.
    student: entry.participant ? {
      ...(actor.dojoIds === null || (entry.student?.dojoId != null && actor.dojoIds.includes(entry.student.dojoId)) ? entry.student : null), firstName: entry.participant.fullName, lastName: '',
      dateOfBirth: entry.participant.dateOfBirth, gender: entry.participant.gender,
    } : entry.student,
  }))
}
