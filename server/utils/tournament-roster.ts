import { and, eq } from 'drizzle-orm'
import { db, tables } from './database'
import { getAccessibleDojoIds } from './permissions'
import { staffTournament } from './tournament-access'

export async function tournamentRoster(userId: number, organizationId: number, tournamentId: number) {
  await staffTournament(organizationId, tournamentId)
  const [entries, accessible] = await Promise.all([
    db.query.studentAchievements.findMany({
      where: and(eq(tables.studentAchievements.tournamentId, tournamentId), eq(tables.studentAchievements.organizationId, organizationId)),
      with: { participant: true, student: { with: { currentBeltRank: true } } },
      orderBy: (table, { asc }) => [asc(table.createdAt), asc(table.id)],
    }),
    getAccessibleDojoIds(userId, organizationId),
  ])
  return entries.filter(entry => accessible === null || (entry.student?.dojoId != null && accessible.includes(entry.student.dojoId))).map(entry => ({
    ...entry,
    // Public form values are the participation snapshot, even for linked students.
    student: entry.participant ? {
      ...entry.student, firstName: entry.participant.fullName, lastName: '',
      dateOfBirth: entry.participant.dateOfBirth, gender: entry.participant.gender,
    } : entry.student,
  }))
}
