import { db, tables } from '../../../../utils/database'
import { eq, and } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const studentId = getRouterParam(event, 'studentId')
  const documentId = getRouterParam(event, 'id')
  if (!studentId || !documentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing IDs' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  // Verify document belongs to student and organization
  const doc = await db.query.documents.findFirst({
    where: and(
      eq(tables.documents.id, Number(documentId)),
      eq(tables.documents.studentId, Number(studentId)),
      eq(tables.documents.organizationId, orgId)
    ),
  })
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  // Delete the file from disk
  try {
    const filePath = path.join(process.cwd(), 'public', doc.fileUrl)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (e) { /* ignore */ }

  await db.delete(tables.documents)
    .where(eq(tables.documents.id, Number(documentId)))

  return { success: true }
})