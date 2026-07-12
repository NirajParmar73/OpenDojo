import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'

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
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  // Fetch assignments with relations
  const assignments = await db.query.studentFeeAssignments.findMany({
    where: eq(tables.studentFeeAssignments.studentId, Number(studentId)),
    with: {
      feePlan: {
        with: { dojo: true },
      },
      payments: true,
    },
    orderBy: (a, { desc }) => [desc(a.startDate)],
  }) as any[] // cast to any

  // Calculate balance
  const assignmentsWithBalance = assignments.map(assignment => {
    const totalPaid = assignment.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
    const netAmount = assignment.feePlan.amount - (assignment.discount || 0)
    return {
      ...assignment,
      outstanding: netAmount - totalPaid,
      netAmount,
    }
  })

  return assignmentsWithBalance
})