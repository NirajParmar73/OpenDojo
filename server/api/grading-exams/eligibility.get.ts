import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { getAccessibleDojoIds } from '../../utils/permissions'

const MINIMUM_ATTENDANCE = 80
const MINIMUM_SESSIONS = 4
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const organizationId = session.user.organizationId
  const accessible = await getAccessibleDojoIds(session.user.id, organizationId)
  const since = new Date(); since.setDate(since.getDate() - 90)
  const [students, attendance, gradings, attempts, systems] = await Promise.all([
    db.query.students.findMany({ where: eq(tables.students.organizationId, organizationId), with: { dojo: true, currentBeltRank: true } }),
    db.query.attendance.findMany({ with: { session: true } }),
    db.query.studentGradings.findMany({ with: { beltRank: true } }),
    db.query.gradingExamAttempts.findMany({ with: { exam: true } }),
    db.query.beltSystems.findMany({ where: eq(tables.beltSystems.organizationId, organizationId), with: { ranks: true } }),
  ])
  const candidates = students.filter(student => student.status === 'active' && student.dojoId && (accessible === null || accessible.includes(student.dojoId))).map(student => {
    const records = attendance.filter(record => record.studentId === student.id && record.session.date >= since)
    const attended = records.filter(record => record.status === 'present' || record.status === 'late').length
    const attendanceRate = records.length ? Math.round((attended / records.length) * 100) : 0
    const latest = gradings.filter(grading => grading.studentId === student.id).sort((a, b) => b.awardedDate.getTime() - a.awardedDate.getTime())[0]
    const studentRanks = systems
      .find(system => system.id === student.currentBeltRank?.systemId)
      ?.ranks.slice().sort((a, b) => a.order - b.order)
      || systems.find(system => !student.programId || system.programId === student.programId)?.ranks.slice().sort((a, b) => a.order - b.order)
      || []
    const currentIndex = studentRanks.findIndex(rank => rank.id === student.currentBeltRankId)
    const nextRank = currentIndex >= 0 ? studentRanks[currentIndex + 1] : studentRanks[0]
    const pendingGradingFee = attempts.some((attempt: any) => attempt.studentId === student.id && attempt.paymentStatus === 'pending' && attempt.exam.organizationId === organizationId)
    const reasons: string[] = []
    if (records.length < MINIMUM_SESSIONS) reasons.push(`Only ${records.length}/${MINIMUM_SESSIONS} recent classes recorded`)
    if (records.length >= MINIMUM_SESSIONS && attendanceRate < MINIMUM_ATTENDANCE) reasons.push(`${attendanceRate}% attendance; ${MINIMUM_ATTENDANCE}% required`)
    if (pendingGradingFee) reasons.push('Pending grading fee')
    if (!nextRank) reasons.push('Highest configured rank reached')
    return { studentId: student.id, studentName: `${student.firstName} ${student.lastName}`, dojoId: student.dojoId, dojoName: student.dojo?.name || 'Unassigned', currentRank: student.currentBeltRank?.name || 'Not assigned', nextRank: nextRank?.name || null, attendanceRate, classesRecorded: records.length, lastGradingDate: latest?.awardedDate || null, daysSinceLastGrading: latest ? Math.floor((Date.now() - latest.awardedDate.getTime()) / 86400000) : null, pendingGradingFee, eligible: reasons.length === 0, reasons }
  })
  return { threshold: { attendance: MINIMUM_ATTENDANCE, classes: MINIMUM_SESSIONS, periodDays: 90 }, candidates: candidates.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.studentName.localeCompare(b.studentName)) }
})
