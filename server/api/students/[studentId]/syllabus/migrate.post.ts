import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { canAssessStudentSyllabus, migrateStudentSyllabusToLatest } from '../../../../utils/syllabus'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number(getRouterParam(event, 'studentId'))
  const organizationId = session?.user?.organizationId
  if (!session?.user || !organizationId || !studentId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const student = await db.query.students.findFirst({
    where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, organizationId)),
  })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (!await canAssessStudentSyllabus(session.user.id, organizationId, student.dojoId)) throw createError({ statusCode: 403, statusMessage: 'You cannot update this student’s syllabus' })

  const result = await migrateStudentSyllabusToLatest(studentId, organizationId)
  if (result.changed) {
    await writeAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: 'student.syllabus_version_updated',
      entityType: 'student',
      entityId: student.id,
      targetLabel: `${student.firstName} ${student.lastName}`,
      scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
      details: `Moved to the latest published syllabus. Preserved ${result.preserved} assessments; ${result.reassessmentRequired} require reassessment.`,
    })
  }
  return result
})
