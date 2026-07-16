import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { isDojoAccessible } from '../../../utils/permissions'
import { syncCurrentBeltRank } from '../../../utils/gradings'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    ),
    with: {
      dojo: true,
      currentBeltRank: true,
    },
  })

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  if (student.dojoId && !await isDojoAccessible(session.user.id, orgId, student.dojoId)) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  if (!student.dojoId && session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const currentBeltRankId = await syncCurrentBeltRank(Number(studentId))
  if (currentBeltRankId === student.currentBeltRankId) return student
  const currentBeltRank = currentBeltRankId
    ? await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, currentBeltRankId) })
    : null
  return { ...student, currentBeltRankId, currentBeltRank }
})
