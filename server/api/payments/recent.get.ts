import { db } from '../../utils/database'
import { getAccessibleDojoIds } from '../../utils/permissions'

type RecentPayment = {
  id: number
  receiptNumber: string
  amount: number
  paymentDate: Date
  method: string | null
  student: { id: number, organizationId: number, dojoId: number | null, firstName: string, lastName: string, dojo: { name: string } | null }
  assignment: { feePlan: { name: string } | null } | null
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const organizationId = session.user.organizationId
  if (!organizationId) throw createError({ statusCode: 400, statusMessage: 'User has no organization' })

  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, organizationId)
  if (accessibleDojoIds !== null && !accessibleDojoIds.length) return []

  const payments = await db.query.payments.findMany({
    with: {
      student: { with: { dojo: true } },
      assignment: { with: { feePlan: true } }
    },
    orderBy: (payments, { desc }) => [desc(payments.paymentDate)]
  }) as RecentPayment[]

  return payments
    .filter(payment => payment.student?.organizationId === organizationId
      && (accessibleDojoIds === null
        ? true
        : payment.student.dojoId !== null && accessibleDojoIds.includes(payment.student.dojoId)))
    .slice(0, 20)
    .map(payment => ({
      id: payment.id,
      receiptNumber: payment.receiptNumber,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      method: payment.method,
      student: {
        id: payment.student.id,
        name: `${payment.student.firstName} ${payment.student.lastName}`,
        dojoName: payment.student.dojo?.name || 'Unassigned'
      },
      feePlanName: payment.assignment?.feePlan?.name || 'General payment'
    }))
})
