import { db, tables } from './database'
import { eq } from 'drizzle-orm'

// The current rank is the most recently awarded grading. If two gradings have
// the same date, the higher order from the organization's belt system wins.
export async function getCurrentBeltRankId(studentId: number) {
  const gradings = await db.query.studentGradings.findMany({
    where: eq(tables.studentGradings.studentId, studentId),
    with: { beltRank: true }
  })
  const current = gradings.sort((left, right) => {
    const dateDifference = new Date(right.awardedDate).getTime() - new Date(left.awardedDate).getTime()
    return dateDifference || ((right.beltRank?.order || 0) - (left.beltRank?.order || 0))
  })[0]
  return current?.beltRankId || null
}

export async function syncCurrentBeltRank(studentId: number) {
  const currentBeltRankId = await getCurrentBeltRankId(studentId)
  await db.update(tables.students).set({ currentBeltRankId, updatedAt: new Date() }).where(eq(tables.students.id, studentId))
  return currentBeltRankId
}
