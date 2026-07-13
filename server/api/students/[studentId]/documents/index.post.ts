import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { allowedDocumentTypes, saveUploadedFile } from '../../../../utils/upload'

const documentTypes = ['aadhaar', 'passport', 'driving_license', 'voter_id', 'other']

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

  // Verify student
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

  const documentType = getField('documentType')
  const documentNumber = getField('documentNumber')
  const issuedDate = getField('issuedDate')
  const expiryDate = getField('expiryDate')
  const notes = getField('notes')
  const filePart = form.find(p => p.name === 'file' && p.filename)

  if (!documentType || !filePart || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Document type and file are required' })
  }

  if (!documentTypes.includes(documentType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid document type' })
  }

  // Save file
  const saved = await saveUploadedFile(
    {
      name: filePart.filename || 'document',
      data: filePart.data,
      filename: filePart.filename || 'document',
      type: filePart.type || 'application/pdf'
    },
    'documents',
    allowedDocumentTypes
  )

  const [doc] = await db.insert(tables.documents).values({
    organizationId: orgId,
    studentId: Number(studentId),
    documentType,
    documentNumber: documentNumber || null,
    fileUrl: saved.path,
    issuedDate: issuedDate ? new Date(issuedDate) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    notes: notes || null
  }).returning()

  if (!doc) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to save document' })
  }

  return { success: true, document: doc }
})
