import { and, eq } from 'drizzle-orm'
import { db, tables } from '../../../../utils/database'
import { allowedDocumentTypes, saveUploadedFile } from '../../../../utils/upload'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.organizationId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const studentId = Number(getRouterParam(event, 'studentId'))
  const gradingId = Number(getRouterParam(event, 'id'))
  if (!studentId || !gradingId) throw createError({ statusCode: 400, statusMessage: 'Invalid grading request' })

  const student = await db.query.students.findFirst({ where: and(eq(tables.students.id, studentId), eq(tables.students.organizationId, session.user.organizationId)) })
  const grading = await db.query.studentGradings.findFirst({ where: and(eq(tables.studentGradings.id, gradingId), eq(tables.studentGradings.studentId, studentId)) })
  if (!student || !grading) throw createError({ statusCode: 404, statusMessage: 'Grading not found' })

  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  const field = (name: string) => form.find(part => part.name === name && !part.filename)?.data.toString() ?? null
  const beltRankId = Number(field('beltRankId'))
  const awardedDate = field('awardedDate')
  if (!beltRankId || !awardedDate || Number.isNaN(new Date(awardedDate).getTime())) throw createError({ statusCode: 400, statusMessage: 'Belt rank and awarded date are required' })

  const rank = await db.query.beltRanks.findFirst({ where: eq(tables.beltRanks.id, beltRankId), with: { system: true } })
  if (!rank || rank.system.organizationId !== session.user.organizationId) throw createError({ statusCode: 400, statusMessage: 'Invalid belt rank' })

  const certificate = form.find(part => part.name === 'certificate' && part.filename)
  let certificateUrl = grading.certificateUrl
  if (certificate?.data) {
    const saved = await saveUploadedFile({ name: certificate.filename || 'certificate', data: certificate.data, filename: certificate.filename || 'certificate', type: certificate.type || 'application/pdf' }, 'certificates', allowedDocumentTypes)
    certificateUrl = saved.path
  }

  await db.update(tables.studentGradings).set({
    beltRankId,
    awardedDate: new Date(awardedDate),
    examiner: field('examiner')?.trim() || null,
    certificateNumber: field('certificateNumber')?.trim() || null,
    notes: field('notes')?.trim() || null,
    certificateUrl,
    updatedAt: new Date(),
  }).where(eq(tables.studentGradings.id, gradingId))

  const latest = await db.query.studentGradings.findFirst({ where: eq(tables.studentGradings.studentId, studentId), orderBy: (item, { desc }) => [desc(item.awardedDate)] })
  await db.update(tables.students).set({ currentBeltRankId: latest?.beltRankId || null, updatedAt: new Date() }).where(eq(tables.students.id, studentId))
  await writeAuditLog({ organizationId: session.user.organizationId, actorUserId: session.user.id, action: 'grading.updated', entityType: 'student_grading', entityId: gradingId, targetLabel: `${student.firstName} ${student.lastName} — ${rank.name}`, scope: student.dojoId ? { type: 'dojo', id: student.dojoId } : { type: 'organization' } })

  return { success: true }
})
