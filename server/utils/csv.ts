export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"'
        index++
      } else if (character === '"') {
        quoted = false
      } else {
        value += character
      }
      continue
    }
    if (character === '"') quoted = true
    else if (character === ',') {
      row.push(value.trim())
      value = ''
    } else if (character === '\n') {
      row.push(value.trim())
      if (row.some(cell => cell.length)) rows.push(row)
      row = []
      value = ''
    } else if (character !== '\r') {
      value += character
    }
  }
  if (quoted) throw createError({ statusCode: 400, statusMessage: 'The CSV contains an unclosed quoted value' })
  row.push(value.trim())
  if (row.some(cell => cell.length)) rows.push(row)
  return rows
}

export function csvCell(value: unknown) {
  const original = String(value ?? '')
  const text = /^[=+\-@]/.test(original) ? `'${original}` : original
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: unknown[][]) {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
