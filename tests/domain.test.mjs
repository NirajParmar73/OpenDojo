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

test('money conversion consistently rounds to minor units', () => {
  assert.equal(currency.toMinorUnits(750.255), 75026)
  assert.equal(currency.fromMinorUnits(75026), 750.26)
  assert.equal(currency.formatAmount(75000, 'INR'), 'INR 750.00')
})
