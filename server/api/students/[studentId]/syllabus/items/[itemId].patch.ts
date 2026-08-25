import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, tables } from '../../../../../utils/database'
import { canAssessStudentSyllabus, ensureStudentSyllabusAssignment, getStudentSyllabusProgress, getVersionSections } from '../../../../../utils/syllabus'
import { writeAuditLog } from '../../../../../utils/audit'

const schema = z.object({ status: z.enum(['not_ready', 'ready']), notes: z.string().trim().max(2000).optional().nullable() })
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const studentId = Number(getRouterParam(event, 'studentId'))
  const itemId = Number(getRouterParam(event, 'itemId'))
  if (!session?.user?.organizationId || !studentId || !itemId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const student = await db.query.students.findFirst({ where: eq(tables.students.id, studentId) })
  if (!student || student.organizationId !== session.user.organizationId) throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  if (!await canAssessStudentSyllabus(session.user.id, session.user.organizationId, student.dojoId)) throw createError({ statusCode: 403, statusMessage: 'You cannot assess this student' })
  const body = await readValidatedBody(event, schema.parse)
  const { progress, assignment } = await ensureStudentSyllabusAssignment(studentId, session.user.organizationId)
  const allowedItems = (await getVersionSections(progress.version!.id)).flatMap(section => section.items.map(item => item.id))
  if (!allowedItems.includes(itemId)) throw createError({ statusCode: 400, statusMessage: 'This item is not part of the student’s assigned syllabus' })
  await db.insert(tables.studentSyllabusAssessments).values({ assignmentId: assignment.id, itemId, status: body.status, notes: body.notes || null, assessedBy: session.user.id, assessedAt: new Date() }).onConflictDoUpdate({
    target: [tables.studentSyllabusAssessments.assignmentId, tables.studentSyllabusAssessments.itemId],
    set: { status: body.status, notes: body.notes || null, assessedBy: session.user.id, assessedAt: new Date(), updatedAt: new Date() },
  })
  const item = await db.query.syllabusItems.findFirst({ where: eq(tables.syllabusItems.id, itemId) })
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'student.syllabus_assessed', entityType: 'student', entityId: student.id, targetLabel: `${student.firstName} ${student.lastName}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' }, details: `${item?.name || 'Syllabus item'} marked ${body.status === 'ready' ? 'ready' : 'not ready'}.` })
  return getStudentSyllabusProgress(studentId, session.user.organizationId)
})
