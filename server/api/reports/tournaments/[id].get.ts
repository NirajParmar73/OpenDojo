import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { buildTournamentReport } from '../../../utils/tournament-report'

type TableColumn = { label: string, width: number, align?: 'left' | 'center' | 'right' }

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const tournamentId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(tournamentId)) throw createError({ statusCode: 400, statusMessage: 'Invalid tournament' })

  const report = await buildTournamentReport(session.user.id, session.user.organizationId, tournamentId)
  const { organization, tournament, summary, categories, dojos, winners } = report
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape', bufferPages: true, info: { Title: `${tournament.name} performance report`, Author: organization?.name || 'OpenDojos' } })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const completed = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })

  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const contentX = 36
  const contentWidth = pageWidth - 72
  const primary = '#7c2d12'
  const accent = '#dc6b57'
  const ink = '#1f2937'
  const muted = '#64748b'
  let y = 0

  const addLogo = (x: number, logoY: number, size: number) => {
    if (!organization?.logo) return
    const publicRoot = path.resolve(process.cwd(), 'public')
    const logoPath = path.resolve(publicRoot, organization.logo.replace(/^[/\\]+/, ''))
    if (!logoPath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(logoPath)) return
    try { doc.image(logoPath, x, logoY, { fit: [size, size], align: 'center', valign: 'center' }) } catch { /* Invalid images are ignored. */ }
  }

  const drawContinuationHeader = () => {
    doc.rect(0, 0, pageWidth, 54).fill(primary)
    doc.roundedRect(contentX, 10, 34, 34, 8).fill('#ffffff')
    addLogo(contentX + 4, 14, 26)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(organization?.name || 'OpenDojos', contentX + 46, 15, { width: 300 })
    doc.font('Helvetica').fontSize(8.5).fillColor('#fed7aa').text(tournament.name, contentX + 46, 31, { width: 430 })
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text('TOURNAMENT PERFORMANCE REPORT', pageWidth - 250, 22, { width: 214, align: 'right' })
    y = 72
  }

  const newPage = () => { doc.addPage(); drawContinuationHeader() }
  const ensureSpace = (height: number) => { if (y + height > pageHeight - 52) newPage() }
  const sectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(subtitle ? 50 : 36)
    doc.roundedRect(contentX, y + 1, 6, subtitle ? 35 : 22, 3).fill(accent)
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text(title, contentX + 16, y)
    if (subtitle) doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(subtitle, contentX + 16, y + 20, { width: contentWidth - 16 })
    y += subtitle ? 48 : 34
  }

  const drawTable = (columns: TableColumn[], rows: string[][], emptyMessage: string) => {
    const headerHeight = 24
    const rowHeight = 30
    const drawHeader = () => {
      doc.roundedRect(contentX, y, contentWidth, headerHeight, 4).fill(primary)
      let x = contentX
      columns.forEach(column => {
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5).text(column.label.toUpperCase(), x + 6, y + 8, { width: column.width - 12, align: column.align || 'left' })
        x += column.width
      })
      y += headerHeight
    }
    if (!rows.length) {
      doc.roundedRect(contentX, y, contentWidth, 42, 5).fill('#f8fafc')
      doc.fillColor(muted).font('Helvetica').fontSize(9).text(emptyMessage, contentX + 12, y + 16, { width: contentWidth - 24, align: 'center' })
      y += 50
      return
    }
    ensureSpace(headerHeight + rowHeight)
    drawHeader()
    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > pageHeight - 52) { newPage(); drawHeader() }
      if (rowIndex % 2 === 0) doc.rect(contentX, y, contentWidth, rowHeight).fill('#f8fafc')
      let x = contentX
      row.forEach((value, index) => {
        const column = columns[index]!
        doc.fillColor(ink).font(index === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(value, x + 6, y + 9, { width: column.width - 12, height: 15, ellipsis: true, align: column.align || 'left' })
        x += column.width
      })
      y += rowHeight
    })
    y += 10
  }

  // Branded report header.
  doc.rect(0, 0, pageWidth, 128).fill(primary)
  doc.circle(pageWidth - 16, 8, 110).fillOpacity(0.10).fill('#fed7aa').fillOpacity(1)
  doc.circle(pageWidth - 110, 116, 52).fillOpacity(0.08).fill('#ffffff').fillOpacity(1)
  doc.roundedRect(contentX, 27, 68, 68, 16).fill('#ffffff')
  addLogo(contentX + 9, 36, 50)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(21).text(organization?.name || 'OpenDojos', contentX + 86, 34, { width: 420 })
  doc.font('Helvetica').fontSize(9).fillColor('#fed7aa').text('TOURNAMENT PERFORMANCE REPORT', contentX + 87, 65, { characterSpacing: 1.2 })
  doc.font('Helvetica-Bold').fontSize(17).fillColor('#ffffff').text(tournament.name, pageWidth - 360, 38, { width: 324, align: 'right' })
  const start = new Date(tournament.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })
  const end = tournament.endDate ? ` – ${new Date(tournament.endDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''
  doc.font('Helvetica').fontSize(9).fillColor('#fed7aa').text(`${tournament.level} · ${tournament.venue || 'Venue not recorded'} · ${start}${end}`, pageWidth - 390, 68, { width: 354, align: 'right' })
  y = 148

  sectionTitle('Executive summary', 'A consolidated view of participation, completed results, and medals in your permitted territory.')
  const statCards = [
    ['COMPETITORS', summary.competitors, '#f1f5f9', '#334155'], ['EVENT ENTRIES', summary.entries, '#eff6ff', '#1d4ed8'], ['MEDALISTS', summary.medalists, '#fefce8', '#a16207'], ['TOTAL MEDALS', summary.totalMedals, '#fff7ed', '#c2410c'],
    ['GOLD', summary.gold, '#fef3c7', '#92400e'], ['SILVER', summary.silver, '#f1f5f9', '#475569'], ['BRONZE', summary.bronze, '#ffedd5', '#9a3412'], ['PENDING', summary.pending, '#f8fafc', '#64748b'],
  ] as const
  statCards.forEach(([label, value, background, color], index) => {
    const cardWidth = (contentWidth - 21) / 4
    const x = contentX + (index % 4) * (cardWidth + 7)
    const cardY = y + Math.floor(index / 4) * 62
    doc.roundedRect(x, cardY, cardWidth, 54, 8).fill(background)
    doc.fillColor(color).font('Helvetica-Bold').fontSize(18).text(String(value), x + 12, cardY + 10)
    doc.font('Helvetica').fontSize(7.5).text(label, x + 12, cardY + 35, { characterSpacing: 0.5 })
  })
  y += 138

  sectionTitle('Dojo performance', 'Ranking: Gold × 3, Silver × 2, Bronze × 1. Medal rate is winning event entries divided by total event entries.')
  drawTable(
    [{ label: 'Rank / dojo', width: 260 }, { label: 'Competitors', width: 80, align: 'center' }, { label: 'Entries', width: 70, align: 'center' }, { label: 'Gold', width: 65, align: 'center' }, { label: 'Silver', width: 65, align: 'center' }, { label: 'Bronze', width: 65, align: 'center' }, { label: 'Rate', width: 75, align: 'center' }, { label: 'Points', width: 89, align: 'center' }],
    dojos.map((dojo, index) => [`${index + 1}. ${dojo.dojoName}`, String(dojo.competitors), String(dojo.entries), String(dojo.gold), String(dojo.silver), String(dojo.bronze), `${dojo.medalRate}%`, String(dojo.points)]),
    'No dojo performance data is available.',
  )

  sectionTitle('Category performance', 'Results grouped by belt division, competition age category, and event.')
  drawTable(
    [{ label: 'Belt division', width: 145 }, { label: 'Age category', width: 145 }, { label: 'Event', width: 105 }, { label: 'Competitors', width: 90, align: 'center' }, { label: 'Entries', width: 75, align: 'center' }, { label: 'Gold', width: 63, align: 'center' }, { label: 'Silver', width: 63, align: 'center' }, { label: 'Bronze', width: 83, align: 'center' }],
    categories.map(category => [category.beltDivisionLabel, category.ageCategory, category.eventType, String(category.competitors), String(category.entries), String(category.gold), String(category.silver), String(category.bronze)]),
    'No category data is available.',
  )

  sectionTitle('Tournament winners', 'All medal-winning event entries ordered by belt division, competition category, event, and place.')
  drawTable(
    [{ label: 'Student', width: 145 }, { label: 'Age', width: 40, align: 'center' }, { label: 'Dojo', width: 125 }, { label: 'Belt division', width: 100 }, { label: 'Category', width: 105 }, { label: 'Event', width: 70 }, { label: 'Result', width: 80 }, { label: 'Medal', width: 83, align: 'center' }],
    winners.map(winner => [winner.studentName, winner.age === null ? '—' : String(winner.age), winner.dojoName, winner.beltDivisionLabel, `${winner.ageCategory}${winner.weightCategory ? ` / ${winner.weightCategory}` : ''}`, winner.eventType, winner.result, winner.medal ? `${winner.medal.charAt(0).toUpperCase()}${winner.medal.slice(1)}` : '—']),
    'No medal winners have been recorded.',
  )

  const range = doc.bufferedPageRange()
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex++) {
    doc.switchToPage(pageIndex)
    doc.moveTo(contentX, pageHeight - 38).lineTo(pageWidth - contentX, pageHeight - 38).strokeColor('#e2e8f0').lineWidth(0.6).stroke()
    doc.fillColor(muted).font('Helvetica').fontSize(7.5).text(`Generated ${new Date().toLocaleString('en-IN')} · ${organization?.name || 'OpenDojos'}`, contentX, pageHeight - 28, { width: contentWidth / 2 })
    doc.text(`Page ${pageIndex + 1} of ${range.count}`, pageWidth - contentX - 120, pageHeight - 28, { width: 120, align: 'right' })
  }
  doc.end()

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="tournament_${tournament.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_performance.pdf"`)
  return await completed
})
