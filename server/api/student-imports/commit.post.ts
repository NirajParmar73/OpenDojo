import { z } from 'zod'
import { writeAuditLog } from '../../utils/audit'
import { enrollStudent } from '../../services/student-enrollment'
import { prepareStudentImportRows, studentImportInputSchema } from '../../services/student-import'

const bodySchema = z.object({
  fileName: z.string().trim().max(255).default('student-import.csv'),
  rows: z.array(studentImportInputSchema).min(1).max(500),
  grantPortalAccess: z.boolean().optional(),
})

function errorMessage(error: any) {
  return error?.statusMessage || error?.data?.statusMessage || error?.message || 'Student could not be imported'
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const actorUserId = session.user.id
  const organizationId = session.user.organizationId
  const body = await readValidatedBody(event, bodySchema.parse)
  const preparedRows = await prepareStudentImportRows(actorUserId, organizationId, body.rows)
  const results: Array<{ rowNumber: number, student: string, result: 'imported' | 'failed', reason: string, studentId?: number, username?: string, temporaryPassword?: string }> = []
  const importedByDojo = new Map<number, number>()

  for (const row of preparedRows) {
    const studentName = `${row.input.firstName} ${row.input.lastName}`.trim() || `Row ${row.rowNumber}`
    if (!row.valid || !row.payload) {
      results.push({ rowNumber: row.rowNumber, student: studentName, result: 'failed', reason: row.errors.join('; ') })
      continue
    }
    try {
      const enrollment = await enrollStudent(actorUserId, organizationId, { ...row.payload, grantPortalAccess: body.grantPortalAccess })
      results.push({
        rowNumber: row.rowNumber,
        student: studentName,
        studentId: enrollment.student.id,
        result: 'imported',
        reason: '',
        username: enrollment.portalCredentials?.username,
        temporaryPassword: enrollment.portalCredentials?.temporaryPassword,
      })
      importedByDojo.set(row.payload.dojoId!, (importedByDojo.get(row.payload.dojoId!) || 0) + 1)
    } catch (error) {
      results.push({ rowNumber: row.rowNumber, student: studentName, result: 'failed', reason: errorMessage(error) })
    }
  }

  const imported = results.filter(result => result.result === 'imported').length
  const failed = results.length - imported
  const auditScopes = importedByDojo.size ? [...importedByDojo.entries()] : [[null, 0] as const]
  await Promise.all(auditScopes.map(([dojoId, dojoImported]) => writeAuditLog({
      organizationId,
      actorUserId,
      action: 'students.import',
      entityType: 'student_import',
      targetLabel: body.fileName,
      scope: dojoId === null ? { type: 'organization' } : { type: 'dojo', id: dojoId },
      details: JSON.stringify({ total: results.length, imported: dojoImported, failed }),
    })))
  return { total: results.length, imported, failed, results }
})
