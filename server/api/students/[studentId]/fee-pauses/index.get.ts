import { eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { requireFeePauseStudent } from '../../../../utils/student-fee-pauses'

export default defineEventHandler(async (event) => {
  const { studentId } = await requireFeePauseStudent(event, 'read')
  return db.query.studentFeePauses.findMany({
    where: eq(tables.studentFeePauses.studentId, studentId),
    with: { creator: { columns: { id: true, name: true } } },
    orderBy: (pause, { desc }) => [desc(pause.startDate)],
  })
})
