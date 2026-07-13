import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { allowedDocumentTypes, saveUploadedFile } from '../../../../utils/upload'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  if (!studentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing student ID' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify student belongs to organization
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(studentId)),
      eq(tables.students.organizationId, orgId)
    )
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const getField = (name: string): string | null => {
    // H3 leaves `type` undefined for ordinary FormData fields. Files are
    // identified by `filename`, so use that distinction instead.
    const part = form.find(p => p.name === name && !p.filename)
    return part ? part.data.toString() : null
  }

  const beltRankId = getField('beltRankId')
  const awardedDate = getField('awardedDate')
  const examiner = getField('examiner')
  const certificateNumber = getField('certificateNumber')
  const notes = getField('notes')
  const certificateFile = form.find(p => p.name === 'certificate' && p.filename)

  if (!beltRankId || !awardedDate) {
    throw createError({ statusCode: 400, statusMessage: 'Belt rank and awarded date are required' })
  }

  // Verify belt rank belongs to the organization's system
  const rank = await db.query.beltRanks.findFirst({
    where: eq(tables.beltRanks.id, Number(beltRankId)),
    with: { system: true }
  })
  if (!rank || rank.system.organizationId !== orgId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid belt rank' })
  }

  let certificateUrl = null
  if (certificateFile && certificateFile.data) {
    try {
      const saved = await saveUploadedFile(
        {
          name: certificateFile.filename || 'certificate',
          data: certificateFile.data,
          filename: certificateFile.filename || 'certificate',
          type: certificateFile.type || 'application/pdf'
        },
        'certificates',
        allowedDocumentTypes
      )
      certificateUrl = saved.path
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Certificate upload failed'
      throw createError({ statusCode: 400, statusMessage: message })
    }
  }

  // Insert grading
  const [grading] = await db.insert(tables.studentGradings).values({
    studentId: Number(studentId),
    beltRankId: Number(beltRankId),
    awardedDate: new Date(awardedDate),
    examiner: examiner || null,
    certificateNumber: certificateNumber?.trim() || null,
    notes: notes || null,
    certificateUrl
  }).returning()

  if (!grading) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create grading' })
  }
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: session.user.id,
    action: 'grading.recorded',
    entityType: 'student_grading',
    entityId: grading.id,
    targetLabel: `${student.firstName} ${student.lastName} — ${rank.name}`,
    scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' },
    details: certificateNumber?.trim() ? `Certificate no. ${certificateNumber.trim()}` : null,
  })

  // Update student's current belt rank
  await db.update(tables.students)
    .set({ currentBeltRankId: Number(beltRankId), updatedAt: new Date() })
    .where(eq(tables.students.id, Number(studentId)))

  return { success: true, grading }
})
