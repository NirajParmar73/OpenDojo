import { db, tables } from '../../../utils/database'
import { eq, and } from 'drizzle-orm'
import { saveUploadedFile } from '../../../utils/upload'

console.log('Avatar endpoint hit')
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const orgId = session.user.organizationId
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'User has no organization' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  // Verify student belongs to organization
  const student = await db.query.students.findFirst({
    where: and(
      eq(tables.students.id, Number(id)),
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

  const filePart = form.find((p) => p.name === 'avatar' && p.filename)
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing avatar file' })
  }

  try {
    const saved = await saveUploadedFile(
      {
        name: filePart.filename || 'avatar',
        data: filePart.data,
        filename: filePart.filename || 'avatar',
        type: filePart.type || 'image/jpeg',
      },
      'avatars'
    )

    await db.update(tables.students)
      .set({ avatar: saved.path, updatedAt: new Date() })
      .where(eq(tables.students.id, Number(id)))

    return { success: true, path: saved.path }
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Upload failed' })
  }
})