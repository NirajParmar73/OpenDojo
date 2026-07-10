import { db, tables } from '../../../../server/utils/database'
import { eq, and } from 'drizzle-orm'
import { saveUploadedFile } from '../../../../server/utils/upload'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const filePart = form.find((p) => p.name === 'certificate' && p.filename)
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing certificate file' })
  }

  // Check user exists
  const user = await db.query.users.findFirst({
    where: and(
      eq(tables.users.id, Number(id)),
      eq(tables.users.organizationId, session.user.organizationId!)
    ),
  })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  try {
    const saved = await saveUploadedFile(
      {
        name: filePart.filename || 'certificate',
        data: filePart.data,
        filename: filePart.filename || 'certificate',
        type: filePart.type || 'application/pdf',
      },
      'certificates'
    )

    await db.update(tables.users)
      .set({ certificateUrl: saved.path, updatedAt: new Date() })
      .where(eq(tables.users.id, Number(id)))

    return { success: true, path: saved.path }
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Upload failed' })
  }
})