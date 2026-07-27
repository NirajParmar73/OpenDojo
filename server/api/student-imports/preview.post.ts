import { parseCsv } from '../../utils/csv'
import { csvRecordsToStudentInputs, prepareStudentImportRows } from '../../services/student-import'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const MAX_ROWS = 500

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file' && part.filename)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Choose a CSV file to preview' })
  if (!file.filename?.toLowerCase().endsWith('.csv')) throw createError({ statusCode: 400, statusMessage: 'Export the spreadsheet as a CSV file before uploading it' })
  if (!file.data.length || file.data.length > MAX_FILE_SIZE) throw createError({ statusCode: 400, statusMessage: 'CSV files must be smaller than 2 MB' })

  const parsed = parseCsv(file.data.toString('utf8'))
  if (parsed.length - 1 > MAX_ROWS) throw createError({ statusCode: 400, statusMessage: `Import up to ${MAX_ROWS} students at a time` })
  const inputs = csvRecordsToStudentInputs(parsed)
  const rows = await prepareStudentImportRows(session.user.id, session.user.organizationId, inputs)
  return {
    fileName: file.filename,
    total: rows.length,
    valid: rows.filter(row => row.valid).length,
    invalid: rows.filter(row => !row.valid).length,
    rows,
  }
})
