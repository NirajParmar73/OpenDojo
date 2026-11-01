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
    assert.ok(publicData.beltOptions.some((option: any) => option.value === 'Green'))
    assert.equal(publicData.beltOptions.some((option: any) => option.value === 'Foreign Only'), false)
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

    const [level] = await db.insert(tables.hierarchyLevels).values({ organizationId, name: 'HTTP territory', order: 1 }).returning()
    const [node] = await db.insert(tables.hierarchyNodes).values({ organizationId, levelId: level!.id, name: 'HTTP territory' }).returning()
    const locations = await db.insert(tables.dojos).values(['A', 'B'].map(name => ({ organizationId, nodeId: node!.id, name: `HTTP location ${name}` }))).returning()
    const [scopedInstructor] = await db.insert(tables.users).values({ organizationId, role: 'instructor', name: 'Scoped instructor', email: 'scoped-instructor@example.test', passwordHash }).returning()
    const [outsideInstructor] = await db.insert(tables.users).values({ organizationId, role: 'instructor', name: 'Other instructor', email: 'outside-instructor@example.test', passwordHash }).returning()
    await db.insert(tables.assignments).values([
      { userId: scopedInstructor!.id, role: 'instructor', scopeType: 'dojo', scopeId: locations[0]!.id },
      { userId: outsideInstructor!.id, role: 'instructor', scopeType: 'dojo', scopeId: locations[1]!.id },
    ])
    const scopedCookie = await login('scoped-instructor@example.test')
    const outsideCookie = await login('outside-instructor@example.test')
    const permissions = await (await request('/api/tournaments/permissions', {}, scopedCookie)).json() as any
    assert.equal(permissions.canCreate, true)
    assert.equal(permissions.organizationWide, false)
    assert.deepEqual(permissions.defaultDojoIds, [locations[0]!.id])
    assert.deepEqual(permissions.dojoOptions.map((item: any) => item.value), [locations[0]!.id])
    const scopedBody = { ...tournamentBody, name: 'Instructor participation', dojoIds: [locations[0]!.id] }
    const scopedResponse = await request('/api/tournaments', { method: 'POST', body: JSON.stringify(scopedBody) }, scopedCookie)
    assert.equal(scopedResponse.status, 200, await scopedResponse.clone().text())
    const scopedTournament = await scopedResponse.json() as any
    assert.deepEqual(scopedTournament.dojoIds, [locations[0]!.id])
    for (const dojoIds of [[], [locations[1]!.id]]) {
      assert.equal((await request('/api/tournaments', { method: 'POST', body: JSON.stringify({ ...scopedBody, dojoIds }) }, scopedCookie)).status, 403)
    }
    const list = await (await request('/api/tournaments', {}, scopedCookie)).json() as any[]
    assert.equal(list.find(item => item.id === scopedTournament.id)!.canManage, true)
    assert.equal(list.find(item => item.id === scopedTournament.id)!.registrationToken, scopedTournament.registrationToken)
    assert.equal(list.find(item => item.id === tournament.id)!.canManage, false)
    assert.equal(list.find(item => item.id === tournament.id)!.registrationToken, null)
    const instructorPage = await request('/tournaments', {}, scopedCookie)
    assert.equal(instructorPage.status, 200)
    const instructorHtml = await instructorPage.text()
    assert.ok(instructorHtml.includes('Create tournament'), 'Assigned instructor must see the creation form')
    assert.ok(instructorHtml.includes('Participating locations'), 'Assigned instructor must see the scope selector')
    const scopedPlayer = await request(`/api/public/tournaments/${scopedTournament.registrationToken}`, { method: 'POST', body: JSON.stringify({ ...body, fullName: 'Instructor Guest Player', requestKey: randomUUID(), kumite: false }) })
    assert.equal(scopedPlayer.status, 200, await scopedPlayer.clone().text())
    const scopedEntries = await (await request(`/api/tournaments/${scopedTournament.id}/entries`, {}, scopedCookie)).json() as any[]
    assert.equal(scopedEntries.length, 1)
    assert.equal(scopedEntries[0]!.studentId, null)
    const scopedEntry = scopedEntries[0]!
    const scopedResultBody = { eventType: scopedEntry.eventType, beltDivision: scopedEntry.beltDivision, ageCategory: scopedEntry.ageCategory, weightCategory: scopedEntry.weightCategory, result: '2nd place', placeSecured: 2 }
    const scopedResult = await request(`/api/tournaments/${scopedTournament.id}/entries/${scopedEntry.id}`, { method: 'PATCH', body: JSON.stringify(scopedResultBody) }, scopedCookie)
    assert.equal(scopedResult.status, 200, await scopedResult.clone().text())
    assert.equal((await scopedResult.json() as any).medalType, 'silver')
    const scopedFile = await request(`/api/tournaments/${scopedTournament.id}/participants.xlsx`, {}, scopedCookie)
    assert.equal(scopedFile.status, 200)
    const scopedWorkbook = new ExcelJS.Workbook()
    await scopedWorkbook.xlsx.load(Buffer.from(await scopedFile.arrayBuffer()))
    assert.equal(scopedWorkbook.worksheets[0]!.getCell('B9').value, 'Instructor Guest Player')
    const scopedEdit = await request(`/api/tournaments/${scopedTournament.id}/participants/${scopedEntries[0]!.participantId}`, { method: 'PATCH', body: JSON.stringify({ ...body, fullName: 'Instructor Guest Player', weightKg: 25, kumite: false }) }, scopedCookie)
    assert.equal(scopedEdit.status, 200, await scopedEdit.clone().text())
    const correctedEntries = await (await request(`/api/tournaments/${scopedTournament.id}/entries`, {}, scopedCookie)).json() as any[]
    assert.equal(correctedEntries[0]!.placeSecured, 2)
    assert.equal(correctedEntries[0]!.weightCategory, '25 kg')
    const ownClose = await request(`/api/tournaments/${scopedTournament.id}/registration`, { method: 'PATCH', body: JSON.stringify({ enabled: false }) }, scopedCookie)
    assert.equal(ownClose.status, 200)
    const ownEdit = await request(`/api/tournaments/${scopedTournament.id}`, { method: 'PATCH', body: JSON.stringify({ ...scopedBody, name: 'Updated instructor tournament', registrationEnabled: false }) }, scopedCookie)
    assert.equal(ownEdit.status, 200, await ownEdit.clone().text())
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}`, { method: 'PATCH', body: JSON.stringify({ ...scopedBody, dojoIds: [locations[1]!.id] }) }, scopedCookie)).status, 400)
    const outsideList = await (await request('/api/tournaments', {}, outsideCookie)).json() as any[]
    assert.equal(outsideList.some(item => item.id === scopedTournament.id), false)
    for (const suffix of ['/entries', '/participants.xlsx']) assert.equal((await request(`/api/tournaments/${scopedTournament.id}${suffix}`, {}, outsideCookie)).status, 404)
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}/entries/${scopedEntry.id}`, { method: 'PATCH', body: JSON.stringify(scopedResultBody) }, outsideCookie)).status, 404)
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}/participants/${scopedEntry.participantId}`, { method: 'DELETE' }, outsideCookie)).status, 404)
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}/registration`, { method: 'PATCH', body: JSON.stringify({ enabled: true }) }, outsideCookie)).status, 404)
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}`, { method: 'DELETE' }, outsideCookie)).status, 404)
    assert.equal((await request(`/api/tournaments/${tournament.id}/registration`, { method: 'PATCH', body: JSON.stringify({ enabled: true }) }, scopedCookie)).status, 403)
    const filteredFile = await request(`/api/tournaments/${tournament.id}/participants.xlsx`, {}, scopedCookie)
    assert.equal(filteredFile.status, 200)
    const filteredWorkbook = new ExcelJS.Workbook()
    await filteredWorkbook.xlsx.load(Buffer.from(await filteredFile.arrayBuffer()))
    assert.ok(filteredWorkbook.worksheets.every(sheet => sheet.rowCount === 8), 'Scoped export must not include organization-wide public-only participants')
    const reportList = await (await request('/api/reports/tournaments', {}, scopedCookie)).json() as any[]
    assert.equal(reportList.find(item => item.id === scopedTournament.id)!.participants, 1)
    const [customSystem] = await db.insert(tables.beltSystems).values({ organizationId, name: 'HTTP custom belt system' }).returning()
    await db.insert(tables.beltRanks).values([
      { systemId: customSystem!.id, name: '9th Kyu - Orange Stripe', level: 'ninth_kyu', type: 'kyu', color: 'orange', order: 1 },
      { systemId: customSystem!.id, name: 'Nidan', level: 'nidan', type: 'dan', color: null, order: 2 },
    ])
    const beltTournamentResponse = await request('/api/tournaments', { method: 'POST', body: JSON.stringify({ ...scopedBody, name: 'Custom belt registration' }) }, scopedCookie)
    assert.equal(beltTournamentResponse.status, 200)
    const beltTournament = await beltTournamentResponse.json() as any
    const refreshedForm = await (await request(`/api/public/tournaments/${beltTournament.registrationToken}/form`)).json() as any
    assert.ok(refreshedForm.beltOptions.some((option: any) => option.value === '9th Kyu - Orange Stripe'))
    assert.equal(refreshedForm.beltOptions.find((option: any) => option.value === 'Nidan')!.division, 'brown_black')
    assert.equal(refreshedForm.beltOptions.some((option: any) => option.value === 'Foreign Only'), false)
    const configuredPage = await request(`/tournament-registration/${beltTournament.registrationToken}`)
    const configuredHtml = await configuredPage.text()
    assert.match(configuredHtml, /9th Kyu - Orange Stripe/)
    assert.match(configuredHtml, /Nidan/)
    const staffBelts = await (await request('/api/tournaments/permissions', {}, scopedCookie)).json() as any
    assert.deepEqual(staffBelts.beltOptions, refreshedForm.beltOptions)
    for (const belt of ['9th Kyu - Orange Stripe', 'Nidan', 'Foreign Only', 'Yellow']) {
      const response = await request(`/api/public/tournaments/${beltTournament.registrationToken}`, { method: 'POST', body: JSON.stringify({ ...body, fullName: `${belt} Player`, belt, kumite: false, requestKey: randomUUID() }) })
      assert.equal(response.status, ['Foreign Only', 'Yellow'].includes(belt) ? 400 : 200, await response.clone().text())
    }
    const customEntries = await (await request(`/api/tournaments/${beltTournament.id}/entries`, {}, scopedCookie)).json() as any[]
    assert.equal(customEntries.length, 2)
    assert.equal(customEntries.find(entry => entry.participant.belt === 'Nidan')!.beltDivision, 'brown_black')
    const customExport = await request(`/api/tournaments/${beltTournament.id}/participants.xlsx`, {}, scopedCookie)
    assert.equal(customExport.status, 200)
    const customWorkbook = new ExcelJS.Workbook()
    await customWorkbook.xlsx.load(Buffer.from(await customExport.arrayBuffer()))
    assert.equal(customWorkbook.worksheets[0]!.getCell('H9').value, '9th Kyu - Orange Stripe')
    assert.equal(customWorkbook.worksheets[1]!.getCell('H9').value, 'Nidan')
    console.log('PASS: public/staff forms fetch current organization belts, custom belt SSR and submissions, foreign and unconfigured belt rejection, Dan classification and exact Excel belt names over HTTP')
    await db.delete(tables.assignments).where(eq(tables.assignments.userId, scopedInstructor!.id))
    const revoked = await (await request('/api/tournaments/permissions', {}, scopedCookie)).json() as any
    assert.equal(revoked.canCreate, false)
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}/entries`, {}, scopedCookie)).status, 404)
    assert.equal((await request('/api/tournaments', { method: 'POST', body: JSON.stringify(scopedBody) }, scopedCookie)).status, 403)
    assert.equal((await request(`/api/tournaments/${scopedTournament.id}`, { method: 'DELETE' }, cookie)).status, 200)
    console.log('PASS: assigned instructor creation and SSR controls, scope escalation rejection, public-only roster and Excel export, profile editing and sharing, cross-scope denial, filtered global exports, scoped reports and assignment revocation over HTTP')
  } finally {
    server.kill()
    await new Promise<void>(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', () => resolve()) })
  }
}
