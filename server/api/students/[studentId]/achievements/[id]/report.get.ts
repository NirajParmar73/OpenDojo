import { and, eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { db, tables } from '../../../../../utils/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const studentId = Number(getRouterParam(event, 'studentId'))
  const achievementId = Number(getRouterParam(event, 'id'))
  const achievement = await db.query.studentAchievements.findFirst({ where: and(eq(tables.studentAchievements.id, achievementId), eq(tables.studentAchievements.studentId, studentId), eq(tables.studentAchievements.organizationId, session.user.organizationId)), with: { tournament: true } })
  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)), with: { dojo: true } })
  if (!achievement || !student) throw createError({ statusCode: 404, statusMessage: 'Achievement not found' })
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId) })

  const doc = new PDFDocument({ margin: 48, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const complete = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const width = doc.page.width - 96
  doc.rect(0, 0, doc.page.width, 118).fill('#312e81')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('STUDENT ACHIEVEMENT CARD', 48, 42, { width, align: 'center' })
  doc.font('Helvetica').fontSize(10).text('Tournament participation and result record', 48, 72, { width, align: 'center' })
  let y = 145
  if (student.avatar) {
    const avatarPath = path.join(process.cwd(), 'public', student.avatar)
    if (fs.existsSync(avatarPath)) { try { doc.image(avatarPath, 48, y, { fit: [90, 90] }) } catch {} }
  }
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(20).text(`${student.firstName} ${student.lastName}`, 158, y + 8)
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Dojo: ${student.dojo?.name || 'Not assigned'}`, 158, y + 39)
  doc.text(`Date of birth: ${student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN') : 'Not recorded'}`, 158, y + 57)
  y += 125
  doc.roundedRect(48, y, width, 94, 8).fill('#eef2ff')
  doc.fillColor('#3730a3').font('Helvetica-Bold').fontSize(11).text(achievement.tournamentName, 64, y + 16)
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`${achievement.tournamentLevel}${achievement.venue ? ` · ${achievement.venue}` : ''}`, 64, y + 36)
  doc.text(`${new Date(achievement.startDate).toLocaleDateString('en-IN')}${achievement.endDate ? ` – ${new Date(achievement.endDate).toLocaleDateString('en-IN')}` : ''}`, 64, y + 54)
  y += 120
  const fields = [
    ['Event', achievement.eventType], ['Age category', achievement.ageCategory], ['Weight category', achievement.weightCategory],
    ['Place/result', achievement.result], ['Medal', achievement.medalType], ['Medals won', String(achievement.medalsWon || 0)],
  ]
  fields.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = 48 + column * (width / 2)
    const fieldY = y + row * 48
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text(label.toUpperCase(), x, fieldY)
    doc.font('Helvetica').fontSize(12).fillColor('#111827').text(value || 'Not recorded', x, fieldY + 14)
  })
  y += 160
  if (achievement.notes) { doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Notes', 48, y); doc.font('Helvetica').fontSize(10).fillColor('#475569').text(achievement.notes, 48, y + 17, { width }) }
  doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`Generated ${new Date().toLocaleString('en-IN')} · ${organization?.name || 'OpenDojo'}`, 48, doc.page.height - 60, { width, align: 'center' })
  doc.end()
  const buffer = await complete
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="achievement_${student.firstName}_${student.lastName}.pdf"`)
  return buffer
})
