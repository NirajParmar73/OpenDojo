import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importTypeScript(file) {
  const source = fs.readFileSync(file, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const fees = await importTypeScript('server/utils/fees.ts')
const currency = await importTypeScript('server/utils/currency.ts')
const refunds = await importTypeScript('server/utils/refunds.ts')
const csv = await importTypeScript('server/utils/csv.ts')
const studentPortal = await importTypeScript('server/utils/student-portal.ts')

test('additional payment charges do not reduce tuition balance', () => {
  const balance = fees.calculateFeeBalance({
    amount: 100_00,
    frequency: 'one-time',
    startDate: new Date('2026-01-01'),
    payments: [{ amount: 125_00, tuitionAmount: 100_00 }],
  }, new Date('2026-01-02'))
  assert.equal(balance.outstandingAmount, 0)
  assert.equal(balance.paidAmount, 100_00)
})

test('legacy payments still credit their full amount to tuition', () => {
  const balance = fees.calculateFeeBalance({
    amount: 100_00,
    frequency: 'one-time',
    startDate: new Date('2026-01-01'),
    payments: [{ amount: 60_00 }],
  }, new Date('2026-01-02'))
  assert.equal(balance.outstandingAmount, 40_00)
})

test('advance payments never produce a negative outstanding balance', () => {
  const input = {
    amount: 1_200_00,
    discount: 200_00,
    frequency: 'monthly',
    startDate: new Date('2026-07-01'),
    payments: [{ amount: 1_000_00 }, { amount: 1_000_00 }],
  }

  const beforeAugustIsDue = fees.calculateFeeBalance(input, new Date('2026-07-31'))
  assert.equal(beforeAugustIsDue.outstandingAmount, 0)

  const afterAugustIsDue = fees.calculateFeeBalance(input, new Date('2026-08-02'))
  assert.equal(afterAugustIsDue.expectedAmount, 2_000_00)
  assert.equal(afterAugustIsDue.outstandingAmount, 0)
})

test('completed tuition refunds restore the outstanding fee balance', () => {
  const balance = fees.calculateFeeBalance({
    amount: 100_00,
    frequency: 'one-time',
    startDate: new Date('2026-01-01'),
    payments: [{
      amount: 125_00,
      tuitionAmount: 100_00,
      refunds: [{ amount: 50_00, tuitionAmount: 25_00, status: 'completed' }],
    }],
  }, new Date('2026-01-02'))
  assert.equal(balance.paidAmount, 75_00)
  assert.equal(balance.outstandingAmount, 25_00)
})

test('refund totals ignore failed refund attempts', () => {
  const payment = {
    amount: 100_00,
    tuitionAmount: 80_00,
    refunds: [
      { amount: 30_00, tuitionAmount: 20_00, status: 'completed' },
      { amount: 10_00, tuitionAmount: 10_00, status: 'failed' },
    ],
  }
  assert.equal(refunds.refundedAmount(payment), 30_00)
  assert.equal(refunds.netPaymentAmount(payment), 70_00)
  assert.equal(refunds.netTuitionAmount(payment), 60_00)
})

test('money conversion consistently rounds to minor units', () => {
  assert.equal(currency.toMinorUnits(750.255), 75026)
  assert.equal(currency.fromMinorUnits(75026), 750.26)
  assert.equal(currency.formatAmount(75000, 'INR'), 'INR 750.00')
})

test('student CSV parsing preserves quoted commas, quotes, and line breaks', () => {
  const rows = csv.parseCsv('First Name,Last Name,Notes\r\nAarav,Sharma,"Needs ""extra"" support, evenings"\r\nPriya,Patel,"Line one\nLine two"')
  assert.deepEqual(rows, [
    ['First Name', 'Last Name', 'Notes'],
    ['Aarav', 'Sharma', 'Needs "extra" support, evenings'],
    ['Priya', 'Patel', 'Line one\nLine two'],
  ])
  assert.equal(csv.toCsv(rows), 'First Name,Last Name,Notes\r\nAarav,Sharma,"Needs ""extra"" support, evenings"\r\nPriya,Patel,"Line one\nLine two"')
  assert.equal(csv.csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"')
})

test('student portal usernames are stable, safe, and unique by student id', () => {
  assert.equal(studentPortal.studentPortalUsername('Élodie', 'O’Connor', 42), 'elodie.o.connor.42')
  assert.equal(studentPortal.studentPortalUsername('Élodie', 'O’Connor', 43), 'elodie.o.connor.43')
  assert.match(studentPortal.studentPortalUsername('李', '雷', 9), /^student\.9$/)
})

test('temporary student portal passwords satisfy the initial password policy', () => {
  const password = studentPortal.generateTemporaryPassword()
  assert.equal(password.length, 14)
  assert.match(password, /[A-Z]/)
  assert.match(password, /[a-z]/)
  assert.match(password, /[2-9]/)
  assert.match(password, /[!@#$%]/)
})
