import { eq } from 'drizzle-orm'
import { db, tables } from './database'
import { getAccessibleDojoIds } from './permissions'
import { getStudentSyllabusProgress } from './syllabus'

const MINIMUM_ATTENDANCE = 80
const MINIMUM_SESSIONS = 4
const PERIOD_DAYS = 90

export async function getGradingEligibility(userId: number, organizationId: number) {
  const accessible = await getAccessibleDojoIds(userId, organizationId)
  const since = new Date(); since.setDate(since.getDate() - PERIOD_DAYS)
  const [students, attendance, gradings, attempts, systems] = await Promise.all([
    db.query.students.findMany({ where: eq(tables.students.organizationId, organizationId), with: { dojo: true, currentBeltRank: true } }),
    db.query.attendance.findMany({ with: { session: true } }),
    db.query.studentGradings.findMany({ with: { beltRank: true } }),
    db.query.gradingExamAttempts.findMany({ with: { exam: true } }),
    db.query.beltSystems.findMany({ where: eq(tables.beltSystems.organizationId, organizationId), with: { ranks: true } }),
  ])
  const candidates = await Promise.all(students.filter(student => student.status === 'active' && student.dojoId && (accessible === null || accessible.includes(student.dojoId))).map(async (student) => {
    const records = attendance.filter(record => record.studentId === student.id && record.session.date >= since)
    const attended = records.filter(record => record.status === 'present' || record.status === 'late').length
    const attendanceRate = records.length ? Math.round((attended / records.length) * 100) : 0
    const latest = gradings.filter(grading => grading.studentId === student.id).sort((a, b) => b.awardedDate.getTime() - a.awardedDate.getTime())[0]
    const studentRanks = systems.find(system => system.id === student.currentBeltRank?.systemId)?.ranks.slice().sort((a, b) => a.order - b.order)
      || systems.find(system => !student.programId || system.programId === student.programId)?.ranks.slice().sort((a, b) => a.order - b.order)
      || []
    const currentIndex = studentRanks.findIndex(rank => rank.id === student.currentBeltRankId)
    const nextRank = currentIndex >= 0 ? studentRanks[currentIndex + 1] : studentRanks[0]
    const studentAttempts = attempts.filter((attempt: any) => attempt.studentId === student.id && attempt.exam.organizationId === organizationId)
    const pendingGradingFee = studentAttempts.some(attempt => attempt.paymentStatus === 'pending' && !['withdrawn', 'absent'].includes(attempt.attendanceStatus))
    const alreadyScheduled = studentAttempts.some((attempt: any) => ['draft', 'open'].includes(attempt.exam.status) && ['registered', 'confirmed', 'appeared'].includes(attempt.attendanceStatus))
    const reasons: string[] = []
    if (records.length < MINIMUM_SESSIONS) reasons.push(`Only ${records.length}/${MINIMUM_SESSIONS} recent classes recorded`)
    if (records.length >= MINIMUM_SESSIONS && attendanceRate < MINIMUM_ATTENDANCE) reasons.push(`${attendanceRate}% attendance; ${MINIMUM_ATTENDANCE}% required`)
    if (pendingGradingFee) reasons.push('Pending grading fee')
    if (alreadyScheduled) reasons.push('Already registered for an open grading exam')
    if (!nextRank) reasons.push('Highest configured rank reached')
    const syllabus = await getStudentSyllabusProgress(student.id, organizationId)
    if (!syllabus?.ready) reasons.push(syllabus?.reason || `${syllabus?.completed || 0}/${syllabus?.total || 0} required syllabus items ready`)
    return { studentId: student.id, studentName: `${student.firstName} ${student.lastName}`, dojoId: student.dojoId!, dojoName: student.dojo?.name || 'Unassigned', currentRank: student.currentBeltRank?.name || 'Not assigned', nextRank: syllabus?.targetRank?.name || nextRank?.name || null, nextRankId: syllabus?.targetRank?.id || nextRank?.id || null, syllabusCompleted: syllabus?.completed || 0, syllabusTotal: syllabus?.total || 0, syllabusReady: syllabus?.ready || false, attendanceRate, classesRecorded: records.length, lastGradingDate: latest?.awardedDate || null, daysSinceLastGrading: latest ? Math.floor((Date.now() - latest.awardedDate.getTime()) / 86400000) : null, pendingGradingFee, alreadyScheduled, eligible: reasons.length === 0, reasons }
  }))
  return { threshold: { attendance: MINIMUM_ATTENDANCE, classes: MINIMUM_SESSIONS, periodDays: PERIOD_DAYS }, candidates: candidates.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.studentName.localeCompare(b.studentName)) }
}
