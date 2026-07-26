import { db, tables } from './database'
import { eq } from 'drizzle-orm'

// The current rank is the most recently awarded grading. If two gradings have
// the same date, the higher order from the organization's belt system wins.
export async function getCurrentBeltRankId(studentId: number) {
  const [gradings, student] = await Promise.all([
    db.query.studentGradings.findMany({
      where: eq(tables.studentGradings.studentId, studentId),
      with: { beltRank: true },
    }),
    db.query.students.findFirst({
      where: eq(tables.students.id, studentId),
      columns: { currentBeltRankId: true },
    }),
  ])
  const current = gradings.sort((left, right) => {
    const dateDifference = new Date(right.awardedDate).getTime() - new Date(left.awardedDate).getTime()
    return dateDifference || ((right.beltRank?.order || 0) - (left.beltRank?.order || 0))
  })[0]
  // Older records may have been created before rank-history entries became
  // canonical. Preserve that stored rank until a grading event supersedes it.
  return current?.beltRankId || student?.currentBeltRankId || null
}

export async function syncCurrentBeltRank(studentId: number) {
  const currentBeltRankId = await getCurrentBeltRankId(studentId)
  await db.update(tables.students).set({ currentBeltRankId, updatedAt: new Date() }).where(eq(tables.students.id, studentId))
  return currentBeltRankId
}
