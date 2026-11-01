import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'

export async function runTournamentHttpChecks(databaseUrl: string, organizationId: number, ownerId: number, instructorId: number) {
  const { db, tables } = await import('../server/utils/database')
  const authRequire = createRequire(import.meta.resolve('nuxt-auth-utils'))
  const { Scrypt } = await import(pathToFileURL(authRequire.resolve('@adonisjs/hash/drivers/scrypt')).href)
  const password = `Test-${randomUUID()}`
  const passwordHash = await new Scrypt({}).make(password)
  await db.update(tables.users).set({ passwordHash }).where(eq(tables.users.id, ownerId))
  await db.update(tables.users).set({ passwordHash }).where(eq(tables.users.id, instructorId))
  const port = await new Promise<number>((resolve, reject) => {
    const socket = createServer()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => { const address = socket.address(); assert.ok(address && typeof address !== 'string'); socket.close(() => resolve(address.port)) })
  })
  const base = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath.includes('bun') ? 'node' : process.execPath, ['.output/server/index.mjs'], {
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: databaseUrl, HOST: '127.0.0.1', PORT: String(port), NUXT_SESSION_PASSWORD: randomUUID() + randomUUID(), NUXT_ENFORCE_APP_SUBDOMAINS: 'false', NUXT_TENANT_BASE_DOMAIN: '', NUXT_PUBLIC_TENANT_BASE_DOMAIN: '', NUXT_APP_URL: base, NUXT_PUBLIC_APP_URL: base },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  server.stdout.on('data', value => { logs = (logs + String(value)).slice(-12000) })
  server.stderr.on('data', value => { logs = (logs + String(value)).slice(-12000) })
  const request = (path: string, options: RequestInit = {}, cookie = '') => fetch(base + path, { ...options, headers: { ...(cookie ? { cookie } : {}), ...(options.body ? { 'content-type': 'application/json', origin: base } : {}), ...options.headers } })
  const login = async (email: string) => {
    const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    assert.equal(response.status, 200, await response.text())
    const cookies = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    assert.ok(cookies)
    return cookies
  }
  try {
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(`Built server exited: ${logs}`)
      try { if ((await request('/api/health')).ok) { ready = true; break } } catch { /* wait for the owned test server */ }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    assert.ok(ready, 'Built server did not become ready within 60 seconds')
    const cookie = await login('owner@example.test')
    const instructorCookie = await login('instructor@example.test')
    const tournamentBody = { name: 'HTTP Tournament', level: 'State', startDate: '2026-12-01', ageCutoffDate: '2026-11-30', coachName: 'Test Coach', participantListTitle: 'HTTP Organizer Participant List' }
    const create = await request('/api/tournaments', { method: 'POST', body: JSON.stringify(tournamentBody) }, cookie)
    assert.equal(create.status, 200, await create.clone().text())
    const tournament = await create.json() as any
    assert.match(tournament.registrationToken, /^[a-f0-9]{64}$/)
    assert.equal(tournament.organizationId, organizationId)
    assert.equal((await request('/api/tournaments', { method: 'POST', body: JSON.stringify(tournamentBody) }, instructorCookie)).status, 403)
    assert.equal((await request(`/api/tournaments/${tournament.id}/participants.xlsx`)).status, 401)
    assert.equal((await request(`/api/tournaments/${tournament.id}/participants.xlsx`, {}, instructorCookie)).status, 403)
    const form = await request(`/api/public/tournaments/${tournament.registrationToken}/form`)
    assert.equal(form.status, 200)
    const publicData = await form.json() as any
    assert.equal(publicData.tournament.name, tournament.name)
    assert.equal('participants' in publicData, false)
    const page = await request(`/tournament-registration/${tournament.registrationToken}`)
    assert.equal(page.status, 200)
    const pageHtml = await page.text()
    assert.match(pageHtml, /HTTP Tournament/)
    assert.match(pageHtml, /Submit participation/)
    assert.match(pageHtml, /Weight \(kg\)/)
    assert.doesNotMatch(pageHtml, /Internal Server Error/)
    const body = { fullName: 'HTTP Colour Player', dateOfBirth: '2017-08-15', weightKg: 20.5, belt: 'Green', gender: 'M', ageCategory: 'Subjunior', kata: true, kumite: true, requestKey: randomUUID(), consent: true }
    const submit = await request(`/api/public/tournaments/${tournament.registrationToken}`, { method: 'POST', body: JSON.stringify(body) })
    assert.equal(submit.status, 200, await submit.clone().text())
    assert.match((await submit.json() as any).reference, /^TP-/)
    const black = await request(`/api/public/tournaments/${tournament.registrationToken}`, { method: 'POST', body: JSON.stringify({ ...body, fullName: 'HTTP Black Player', belt: 'Black', kata: false, requestKey: randomUUID() }) })
    assert.equal(black.status, 200, await black.clone().text())
    const readEntries = await request(`/api/tournaments/${tournament.id}/entries`, {}, cookie)
    assert.equal(readEntries.status, 200)
    const entries = await readEntries.json() as any[]
    assert.equal(entries.length, 3)
    assert.ok(entries.every(entry => entry.placeSecured === null && entry.participantId))
    const first = entries[0]!
    const result = await request(`/api/tournaments/${tournament.id}/entries/${first.id}`, { method: 'PATCH', body: JSON.stringify({ eventType: first.eventType, beltDivision: first.beltDivision, ageCategory: first.ageCategory, weightCategory: first.weightCategory, result: '1st place', placeSecured: 1 }) }, cookie)
    assert.equal(result.status, 200, await result.clone().text())
    assert.equal((await result.json() as any).medalType, 'gold')
    const edit = await request(`/api/tournaments/${tournament.id}/participants/${first.participantId}`, { method: 'PATCH', body: JSON.stringify({ ...body, weightKg: 22 }) }, cookie)
    assert.equal(edit.status, 200, await edit.clone().text())
    const updated = await (await request(`/api/tournaments/${tournament.id}/entries`, {}, cookie)).json() as any[]
    assert.equal(updated.find(entry => entry.id === first.id)!.placeSecured, 1)
    assert.equal(updated.find(entry => entry.id === first.id)!.weightCategory, '22 kg')
    for (const division of ['colour', 'brown_black', '']) {
      const file = await request(`/api/tournaments/${tournament.id}/participants.xlsx${division ? `?division=${division}` : ''}`, {}, cookie)
      assert.equal(file.status, 200, file.status === 200 ? '' : await file.text())
      assert.match(file.headers.get('content-disposition') || '', /attachment; filename=/)
      assert.match(file.headers.get('content-type') || '', /spreadsheetml/)
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()))
      assert.equal(workbook.worksheets.length, division ? 1 : 2)
      assert.equal(workbook.worksheets[0]!.getCell('A3').value, tournamentBody.participantListTitle)
      assert.equal(workbook.worksheets[0]!.rowCount, 9)
      if (division === 'colour') assert.equal(workbook.worksheets[0]!.getCell('G9').value, '22 kg')
    }
    const setupPage = await request('/tournaments', {}, cookie)
    assert.equal(setupPage.status, 200)
    assert.match(await setupPage.text(), /Public participation form/)
    const resultsPage = await request(`/tournament-results?tournament=${tournament.id}`, {}, cookie)
    assert.equal(resultsPage.status, 200)
    const resultsHtml = await resultsPage.text()
    assert.match(resultsHtml, /Tournament results/)
    assert.ok(resultsHtml.includes('HTTP Colour Player'), 'Initial results HTML must contain the colour-belt player')
    assert.ok(resultsHtml.includes('HTTP Black Player'), 'Initial results HTML must contain the black-belt player')
    const close = await request(`/api/tournaments/${tournament.id}/registration`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) }, cookie)
    assert.equal(close.status, 200)
    const late = await request(`/api/public/tournaments/${tournament.registrationToken}`, { method: 'POST', body: JSON.stringify({ ...body, fullName: 'Late HTTP Player', requestKey: randomUUID() }) })
    assert.equal(late.status, 409)
    const closedPage = await request(`/tournament-registration/${tournament.registrationToken}`)
    assert.match(await closedPage.text(), /Registration is closed/)
    console.log('PASS: real HTTP tournament creation, authorization, anonymous form SSR and submission, result editing, profile corrections, all Excel downloads, admin SSR pages and registration closure')
  } finally {
    server.kill()
    await new Promise<void>(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve()) })
  }
}
