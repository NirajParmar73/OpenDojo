import { and, eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { db, tables } from '../../../utils/database'
import { hasStudentReportAccess } from '../../../utils/permissions'
import { getCurrentBeltRankId } from '../../../utils/gradings'
import { getStudentSyllabusProgress } from '../../../utils/syllabus'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const studentId = Number(getRouterParam(event, 'studentId'))
  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)),
    with: { dojo: true, program: true, currentBeltRank: true }
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  const portalStudentId = Number((session.user as unknown as Record<string, unknown>).studentId)
  const isOwnPortalReport = session.user.role === 'student' && portalStudentId === studentId
  if (!isOwnPortalReport && !await hasStudentReportAccess(session.user.id, session.user.organizationId, student.dojoId)) throw createError({ statusCode: 403, statusMessage: 'You do not have permission to view student reports' })

  const [gradings, attendance, achievements, organization, syllabusProgress] = await Promise.all([
    db.query.studentGradings.findMany({ where: eq(tables.studentGradings.studentId, studentId), with: { beltRank: true }, orderBy: (grading, { asc }) => [asc(grading.awardedDate)] }),
    db.query.attendance.findMany({ where: eq(tables.attendance.studentId, studentId), with: { session: true } }),
    db.query.studentAchievements.findMany({ where: eq(tables.studentAchievements.studentId, studentId), orderBy: (achievement, { desc }) => [desc(achievement.startDate)] }),
    db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId) }),
    getStudentSyllabusProgress(studentId, session.user.organizationId)
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
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(organization?.name || 'OpenDojos', 48, y, { width: contentWidth, align: 'center' })
  y += 29
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#6366f1').text('STUDENT PROGRESS REPORT', 48, y, { width: contentWidth, align: 'center', characterSpacing: 1.2 })
  y += 34
  doc.roundedRect(48, y, contentWidth, 86, 8).fill('#eef2ff')
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(`${student.firstName} ${student.lastName}`, 64, y + 15)
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(`Dojo: ${student.dojo?.name || 'Not assigned'} • Member since: ${student.joinedAt.toLocaleDateString('en-IN')}`, 64, y + 40)
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(`Program: ${student.program?.displayName || 'Not assigned'}`, 64, y + 56)
  y += 108

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

  startNewPageIfNeeded(120)
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Next grading syllabus', 48, y)
  y += 22
  if (!syllabusProgress?.version) {
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text(syllabusProgress?.reason || 'No published syllabus is available for this student.', 48, y)
    y += 26
  } else {
    const percentage = syllabusProgress.total ? Math.round(syllabusProgress.completed / syllabusProgress.total * 100) : 0
    const targetRank = syllabusProgress.targetRank?.name || 'Next rank'
    const summaryHeight = syllabusProgress.migration?.available ? 86 : 68
    doc.roundedRect(48, y, contentWidth, summaryHeight, 7).fill('#f5f3ff')
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#312e81').text(`Preparing for ${targetRank}`, 60, y + 12)
    doc.font('Helvetica').fontSize(9.5).fillColor('#4b5563').text(`Version ${syllabusProgress.version.version} • ${syllabusProgress.completed} of ${syllabusProgress.total} required items ready (${percentage}%)`, 60, y + 31)
    const barWidth = contentWidth - 24
    doc.roundedRect(60, y + 49, barWidth, 7, 3.5).fill('#ddd6fe')
    if (percentage > 0) doc.roundedRect(60, y + 49, barWidth * Math.min(percentage, 100) / 100, 7, 3.5).fill(syllabusProgress.ready ? '#16a34a' : '#7c3aed')
    if (syllabusProgress.migration?.available) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#b45309').text(`A newer syllabus version (${syllabusProgress.migration.toVersion}) is available.`, 60, y + 65)
    }
    y += summaryHeight + 15

    for (const section of syllabusProgress.sections) {
      const sectionDescriptionHeight = section.description
        ? doc.font('Helvetica').fontSize(9).heightOfString(section.description, { width: contentWidth - 20 })
        : 0
      startNewPageIfNeeded(32 + sectionDescriptionHeight)
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(section.name, 48, y)
      y += 16
      if (section.description) {
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(section.description, 58, y, { width: contentWidth - 20 })
        y += sectionDescriptionHeight + 7
      }

      for (const item of section.items as Array<(typeof section.items)[number] & { inherited?: boolean }>) {
        const qualifiers = [item.required ? null : 'Optional', item.inherited ? 'Earlier belt' : null].filter(Boolean).join(' • ')
        const itemLabel = `${item.name}${qualifiers ? ` (${qualifiers})` : ''}`
        const labelWidth = contentWidth - 108
        const labelHeight = doc.font('Helvetica').fontSize(9.5).heightOfString(itemLabel, { width: labelWidth })
        const descriptionHeight = item.description
          ? doc.font('Helvetica').fontSize(8.5).heightOfString(item.description, { width: labelWidth })
          : 0
        const rowHeight = Math.max(26, 12 + labelHeight + (descriptionHeight ? descriptionHeight + 4 : 0))
        startNewPageIfNeeded(rowHeight + 4)
        doc.roundedRect(48, y, contentWidth, rowHeight, 4).fill('#f8fafc')
        doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(itemLabel, 58, y + 7, { width: labelWidth })
        if (item.description) doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text(item.description, 58, y + 9 + labelHeight, { width: labelWidth })
        const itemReady = item.assessment?.status === 'ready'
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(itemReady ? '#15803d' : '#64748b').text(itemReady ? 'READY' : 'WORKING', 48 + contentWidth - 88, y + 8, { width: 78, align: 'right' })
        y += rowHeight + 4
      }
      y += 8
    }
  }

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
  setHeader(event, 'Content-Length', buffer.length)
  return buffer
})
