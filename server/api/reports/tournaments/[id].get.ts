import { and, eq } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import { db, tables } from '../../../utils/database'
import { getAccessibleDojoIds } from '../../../utils/permissions'

function yearsOld(dateOfBirth: Date | null, onDate: Date) {
  if (!dateOfBirth) return '—'
  let age = onDate.getFullYear() - dateOfBirth.getFullYear()
  const anniversary = new Date(onDate.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate())
  if (anniversary > onDate) age -= 1
  return String(age)
}

function medalCount(achievement: { medalType: string | null, medalsWon: number }) {
  return achievement.medalType?.trim() ? Math.max(achievement.medalsWon || 0, 1) : achievement.medalsWon || 0
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const tournamentId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(tournamentId)) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })

  const tournament = await db.query.tournaments.findFirst({
    where: and(eq(tables.tournaments.id, tournamentId), eq(tables.tournaments.organizationId, session.user.organizationId)),
  })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournament not found' })
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.id, session.user.organizationId) })

  const accessibleDojoIds = await getAccessibleDojoIds(session.user.id, session.user.organizationId)
  const records = await db.query.studentAchievements.findMany({
    where: and(eq(tables.studentAchievements.organizationId, session.user.organizationId), eq(tables.studentAchievements.tournamentId, tournamentId)),
    with: { student: { with: { dojo: true } } },
  })
  const visible = records.filter(record => accessibleDojoIds === null || (record.student.dojoId !== null && accessibleDojoIds.includes(record.student.dojoId)))
  if (!visible.length) throw createError({ statusCode: 403, statusMessage: 'This tournament is outside your permitted territory' })

  const summary = { participants: new Set(visible.map(record => record.studentId)).size, gold: 0, silver: 0, bronze: 0 }
  for (const record of visible) {
    const medal = record.medalType?.trim().toLowerCase()
    const count = medalCount(record)
    if (medal === 'gold') summary.gold += count
    if (medal === 'silver') summary.silver += count
    if (medal === 'bronze') summary.bronze += count
  }

  const doc = new PDFDocument({ margin: 42, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const pageWidth = doc.page.width - 84
  const start = new Date(tournament.startDate).toLocaleDateString('en-IN')
  const end = tournament.endDate ? ` - ${new Date(tournament.endDate).toLocaleDateString('en-IN')}` : ''

  doc.rect(0, 0, doc.page.width, 112).fill('#312e81')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(21).text('TOURNAMENT ACHIEVEMENT REPORT', 42, 32, { width: pageWidth, align: 'center' })
  doc.font('Helvetica').fontSize(10).text('Participation and medal summary for your permitted territory', 42, 62, { width: pageWidth, align: 'center' })
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(18).text(tournament.name, 42, 140, { width: pageWidth })
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`${tournament.level} | ${tournament.venue || 'Venue not recorded'} | ${start}${end}`, 42, 166, { width: pageWidth })

  const stats = [
    ['Students', String(summary.participants), '#ede9fe', '#5b21b6'],
    ['Gold', String(summary.gold), '#fef3c7', '#92400e'],
    ['Silver', String(summary.silver), '#f1f5f9', '#334155'],
    ['Bronze', String(summary.bronze), '#ffedd5', '#9a3412'],
  ]
  stats.forEach(([label, value, background, color], index) => {
    const x = 42 + index * (pageWidth / 4)
    doc.roundedRect(x, 198, pageWidth / 4 - 9, 55, 7).fill(background)
    doc.fillColor(color).font('Helvetica-Bold').fontSize(17).text(value, x + 12, 208)
    doc.font('Helvetica').fontSize(8).text(label.toUpperCase(), x + 12, 231)
  })

  let y = 281
  const headers = [['Student', 42, 135], ['Age', 177, 33], ['Dojo', 210, 94], ['Event / category', 304, 115], ['Result', 419, 72], ['Medal', 491, 63]]
  const drawHeader = () => {
    doc.rect(42, y, pageWidth, 22).fill('#312e81')
    headers.forEach(([label, x, width]) => doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7).text(label, x as number + 6, y + 7, { width: width as number - 10 }))
    y += 22
  }
  const newPage = () => { doc.addPage(); y = 48; drawHeader() }
  drawHeader()
  visible.sort((a, b) => `${a.student.firstName} ${a.student.lastName}`.localeCompare(`${b.student.firstName} ${b.student.lastName}`)).forEach((record, index) => {
    const rowHeight = 39
    if (y + rowHeight > doc.page.height - 54) newPage()
    if (index % 2 === 0) doc.rect(42, y, pageWidth, rowHeight).fill('#f8fafc')
    const event = [record.eventType, record.ageCategory, record.weightCategory].filter(Boolean).join(' / ') || '—'
    const cells = [
      [`${record.student.firstName} ${record.student.lastName}`, 42, 135],
      [yearsOld(record.student.dateOfBirth, tournament.startDate), 177, 33],
      [record.student.dojo?.name || '—', 210, 94],
      [event, 304, 115],
      [record.result || '—', 419, 72],
      [record.medalType || (record.medalsWon ? `${record.medalsWon} won` : '—'), 491, 63],
    ]
    cells.forEach(([value, x, width], cellIndex) => doc.fillColor('#1e293b').font(cellIndex === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(value as string, x as number + 6, y + 8, { width: width as number - 10, height: 26, ellipsis: true }))
    y += rowHeight
  })
  doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`Generated ${new Date().toLocaleString('en-IN')} | ${organization?.name || 'OpenDojo'}`, 42, doc.page.height - 35, { width: pageWidth, align: 'center' })
  doc.end()

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="tournament_${tournament.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf"`)
  return await completed
})
