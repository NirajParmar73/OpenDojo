import { and, eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { db, tables } from '../../../utils/database'
import { isDojoAccessible } from '../../../utils/permissions'
import { getCurrentBeltRankId } from '../../../utils/gradings'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const studentId = Number(getRouterParam(event, 'studentId'))
  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)),
    with: { dojo: true, currentBeltRank: true }
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const portalStudentId = Number((session.user as unknown as Record<string, unknown>).studentId)
  const isOwnPortalReport = session.user.role === 'student' && portalStudentId === studentId
  if (!isOwnPortalReport && (student.dojoId ? !await isDojoAccessible(session.user.id, session.user.organizationId, student.dojoId) : session.user.role !== 'owner')) throw createError({ statusCode: 403, statusMessage: 'Access denied' })

  const [gradings, attendance, achievements, organization] = await Promise.all([
    db.query.studentGradings.findMany({ where: eq(tables.studentGradings.studentId, studentId), with: { beltRank: true }, orderBy: (grading, { asc }) => [asc(grading.awardedDate)] }),
    db.query.attendance.findMany({ where: eq(tables.attendance.studentId, studentId), with: { session: true } }),
    db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.studentId, studentId), orderBy: (achievement, { desc }) => [desc(achievement.startDate)] }),
    db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId) })
  ])
  const total = attendance.length
  const present = attendance.filter(record => record.status === 'present' || record.status === 'late').length
  const rate = total ? Math.round((present / total) * 100) : 0
  const currentBeltRankId = await getCurrentBeltRankId(studentId)
  const currentGrading = gradings.find(grading => grading.beltRankId === currentBeltRankId)
  const currentRank = currentGrading?.beltRank?.name || student.currentBeltRank?.name || 'Not assigned'
  const currentLevel = currentGrading?.beltRank?.level || student.currentBeltRank?.level || 'Not assigned'

  const doc = new PDFDocument({ margin: 48, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const pageWidth = doc.page.width
  const contentWidth = pageWidth - 96
  const pageBottom = doc.page.height - 74
  let y = 48
  const startNewPageIfNeeded = (height: number) => {
    if (y + height <= pageBottom) return
    doc.addPage()
    y = 48
  }

  if (organization?.logo) {
    const logoPath = path.join(process.cwd(), 'public', organization.logo)
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, pageWidth / 2 - 26, y, { width: 52, height: 52 })
        y += 62
      } catch { /* Ignore invalid logo files. */ }
    }
  }
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(organization?.name || 'OpenDojo', 48, y, { width: contentWidth, align: 'center' })
  y += 29
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#6366f1').text('STUDENT PROGRESS REPORT', 48, y, { width: contentWidth, align: 'center', characterSpacing: 1.2 })
  y += 34
  doc.roundedRect(48, y, contentWidth, 72, 8).fill('#eef2ff')
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(`${student.firstName} ${student.lastName}`, 64, y + 15)
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(`Dojo: ${student.dojo?.name || 'Not assigned'} • Member since: ${student.joinedAt.toLocaleDateString('en-IN')}`, 64, y + 40)
  y += 94

  const statWidth = (pageWidth - 114) / 4
  const stats = [{ label: 'CURRENT RANK', value: currentRank, color: '#ede9fe' }, { label: 'KYU / DAN LEVEL', value: currentLevel, color: '#fef3c7' }, { label: 'ATTENDANCE RATE', value: `${rate}%`, color: '#dcfce7' }, { label: 'SESSIONS RECORDED', value: String(total), color: '#e0f2fe' }]
  stats.forEach((stat, index) => {
    const x = 48 + index * (statWidth + 6)
    doc.roundedRect(x, y, statWidth, 54, 7).fill(stat.color)
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#64748b').text(stat.label, x + 10, y + 10)
    doc.fontSize(14).fillColor('#0f172a').text(stat.value, x + 10, y + 27, { width: statWidth - 20 })
  })
  y += 78

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Attendance summary', 48, y)
  y += 19
  doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text(`Present or late: ${present} of ${total} recorded sessions`, 48, y)
  y += 30

  startNewPageIfNeeded(48)
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Grading journey', 48, y)
  y += 20
  if (!gradings.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text('No gradings have been recorded yet.', 48, y)
    y += 22
  }
  for (const grading of gradings) {
    startNewPageIfNeeded(27)
    doc.roundedRect(48, y - 2, contentWidth, 22, 4).fill('#f8fafc')
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`${grading.awardedDate.toLocaleDateString('en-IN')} — ${grading.beltRank?.name || 'Rank'}${grading.beltRank?.level ? ` (${grading.beltRank.level})` : ''}${grading.examiner ? ` (Examiner: ${grading.examiner})` : ''}${grading.certificateNumber ? ` | Certificate no. ${grading.certificateNumber}` : ''}`, 58, y + 4)
    y += 27
  }

  y += 16
  startNewPageIfNeeded(45)
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Tournament participation & achievements', 48, y)
  y += 20
  if (!achievements.length) {
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text('No tournament participation has been recorded yet.', 48, y)
    y += 22
  }
  for (const achievement of achievements) {
    const eventDetails = [achievement.eventType, achievement.ageCategory, achievement.weightCategory].filter(Boolean).join(' • ')
    const result = achievement.result || achievement.medalType
      ? [achievement.result, achievement.medalType ? `${achievement.medalType}${achievement.medalsWon ? ` (${achievement.medalsWon} medal${achievement.medalsWon === 1 ? '' : 's'})` : ''}` : ''].filter(Boolean).join(' • ')
      : 'Participation'
    const rowHeight = eventDetails ? 54 : 40
    startNewPageIfNeeded(rowHeight + 5)
    doc.roundedRect(48, y - 2, contentWidth, rowHeight, 4).fill('#f8fafc')
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(`${achievement.tournamentName} — ${achievement.tournamentLevel}`, 58, y + 5)
    doc.font('Helvetica').fontSize(9.5).fillColor('#4b5563').text(`${new Date(achievement.startDate).toLocaleDateString('en-IN')}${achievement.venue ? ` • ${achievement.venue}` : ''} | ${result}`, 58, y + 20)
    if (eventDetails) doc.fontSize(9).fillColor('#64748b').text(eventDetails, 58, y + 35)
    y += rowHeight + 5
  }

  startNewPageIfNeeded(35)
  doc.font('Helvetica').fontSize(9.5).fillColor('#6b7280').text(`Generated on ${new Date().toLocaleDateString('en-IN')} • This report is shareable with the student or guardian.`, 48, y + 12, { width: contentWidth, align: 'center' })
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  doc.end()
  const buffer = await bufferPromise
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="progress_${student.firstName}_${student.lastName}.pdf"`)
  return buffer
})
