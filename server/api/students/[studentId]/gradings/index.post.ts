import { z } from 'zod'
import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { saveUploadedFile } from '../../../../utils/upload'

const createGradingSchema = z.object({
  beltRankId: z.number().int().positive(),
  awardedDate: z.string(),
  examiner: z.string().optional(),
  notes: z.string().optional(),
})

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
    ),
  })
  if (!student) {
    throw createError({ statusCode: 404, statusMessage: 'Student not found' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const getField = (name: string): string | null => {
    const part = form.find((p) => p.name === name && p.type === 'text')
    return part ? part.data.toString() : null
  }

  const beltRankId = getField('beltRankId')
  const awardedDate = getField('awardedDate')
  const examiner = getField('examiner')
  const notes = getField('notes')
  const certificateFile = form.find((p) => p.name === 'certificate' && p.filename)

  if (!beltRankId || !awardedDate) {
    throw createError({ statusCode: 400, statusMessage: 'Belt rank and awarded date are required' })
  }

  // Verify belt rank belongs to the organization's system
  const rank = await db.query.beltRanks.findFirst({
    where: eq(tables.beltRanks.id, Number(beltRankId)),
    with: { system: true },
  }) as any
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
          type: certificateFile.type || 'application/pdf',
        },
        'certificates'
      )
      certificateUrl = saved.path
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err.message || 'Certificate upload failed' })
    }
  }

  // Insert grading
  const [grading] = await db.insert(tables.studentGradings).values({
    studentId: Number(studentId),
    beltRankId: Number(beltRankId),
    awardedDate: new Date(awardedDate),
    examiner: examiner || null,
    notes: notes || null,
    certificateUrl,
  }).returning() as any[]

  if (!grading) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create grading' })
  }

  // Update student's current belt rank
  await db.update(tables.students)
    .set({ currentBeltRankId: Number(beltRankId), updatedAt: new Date() })
    .where(eq(tables.students.id, Number(studentId)))

  return { success: true, grading }
})