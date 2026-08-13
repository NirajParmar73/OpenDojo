import { and, eq } from 'drizzle-orm'
import { buildFeePeriodLedger } from './fee-ledger'
import { db, tables } from './database'
import { sendPushToStudents } from './student-push'

export const FEE_REMINDER_CUTOFF_DAY = 10
export const FEE_REMINDER_INTERVAL_DAYS = 3

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000)
}

function reminderCutoff(period: string, dueDate: Date) {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7)) - 1
  const afterTenth = new Date(Date.UTC(year, month, FEE_REMINDER_CUTOFF_DAY + 1))
  return dueDate > afterTenth ? dueDate : afterTenth
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100)
}

/**
 * Reconcile one student's materialized fee notices against the canonical fee
 * ledger. It is safe to call on every inbox request and after payment changes.
 */
export async function reconcileStudentFeeNotifications(studentId: number, organizationId: number, now = new Date()) {
  const [student, organization, assignments, existing] = await Promise.all([
    db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)) }),
    db.query.organizations.findFirst({ where: eq(tables.organizations.id, organizationId), columns: { currency: true } }),
    db.query.studentFeeAssignments.findMany({
      where: and(eq(tables.studentFeeAssignments.studentId, studentId), eq(tables.studentFeeAssignments.status, 'active')),
      with: { feePlan: true, payments: { with: { refunds: true } } },
    }),
    db.query.studentNotifications.findMany({
      where: and(eq(tables.studentNotifications.studentId, studentId), eq(tables.studentNotifications.organizationId, organizationId)),
    }),
  ])

  if (!student || student.status === 'archived') {
    if (existing.length) {
      await db.update(tables.studentNotifications)
        .set({ resolvedAt: now, updatedAt: now })
        .where(and(eq(tables.studentNotifications.studentId, studentId), eq(tables.studentNotifications.organizationId, organizationId)))
    }
    return
  }

  const existingByPeriod = new Map(existing.map(item => [`${item.assignmentId}:${item.billingPeriod}`, item]))
  const activePeriods = new Set<string>()
  const currency = organization?.currency || 'USD'
  const pushNotices: Array<{ title: string, message: string }> = []

  for (const assignment of assignments) {
    if (!assignment.feePlan || assignment.feePlan.frequency !== 'monthly') continue
    const ledger = buildFeePeriodLedger({
      amount: assignment.feePlan.amount,
      discount: assignment.discount,
      frequency: assignment.feePlan.frequency,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      dueDay: assignment.dueDay,
      payments: assignment.payments,
    }, now)

    for (const period of ledger.periods) {
      const dueDate = new Date(period.dueDate)
      if (!period.scheduled || period.outstandingAmount <= 0 || now < reminderCutoff(period.key, dueDate)) continue

      const identity = `${assignment.id}:${period.key}`
      activePeriods.add(identity)
      const current = existingByPeriod.get(identity)
      const title = `Fee overdue for ${period.label}`
      const message = `${money(period.outstandingAmount, currency)} remains outstanding. This notice will stop when the payment is recorded.`

      if (!current) {
        const inserted = await db.insert(tables.studentNotifications).values({
          organizationId,
          studentId,
          assignmentId: assignment.id,
          billingPeriod: period.key,
          title,
          message,
          outstandingAmount: period.outstandingAmount,
          lastRemindedAt: now,
          nextReminderAt: addDays(now, FEE_REMINDER_INTERVAL_DAYS),
        }).onConflictDoNothing().returning({ id: tables.studentNotifications.id })
        if (inserted.length) pushNotices.push({ title, message })
        continue
      }

      const reminderDue = current.resolvedAt !== null || current.nextReminderAt <= now
      await db.update(tables.studentNotifications).set({
        title,
        message,
        outstandingAmount: period.outstandingAmount,
        resolvedAt: null,
        readAt: reminderDue ? null : current.readAt,
        lastRemindedAt: reminderDue ? now : current.lastRemindedAt,
        nextReminderAt: reminderDue ? addDays(now, FEE_REMINDER_INTERVAL_DAYS) : current.nextReminderAt,
        reminderCount: reminderDue ? current.reminderCount + 1 : current.reminderCount,
        updatedAt: now,
      }).where(eq(tables.studentNotifications.id, current.id))
      if (reminderDue) pushNotices.push({ title, message })
    }
  }

  for (const notice of existing) {
    if (!notice.resolvedAt && !activePeriods.has(`${notice.assignmentId}:${notice.billingPeriod}`)) {
      await db.update(tables.studentNotifications)
        .set({ resolvedAt: now, updatedAt: now })
        .where(eq(tables.studentNotifications.id, notice.id))
    }
  }

  if (pushNotices.length) {
    const latest = pushNotices.at(-1)!
    await sendPushToStudents([studentId], {
      title: pushNotices.length === 1 ? latest.title : `${pushNotices.length} fee payments need attention`,
      body: pushNotices.length === 1 ? latest.message : 'Open the student portal to review the outstanding fee reminders.',
      url: '/portal?tab=fees',
      tag: `fee-reminder-${studentId}`,
    }).catch(error => console.error('Could not dispatch student fee push notification.', error))
  }
}
