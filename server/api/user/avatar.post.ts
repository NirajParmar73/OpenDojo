// server/api/user/avatar.post.ts
import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { saveUploadedFile } from '../../../server/utils/upload'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
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

    // Update user record
    await db.update(tables.users)
      .set({ avatar: saved.path, updatedAt: new Date() })
      .where(eq(tables.users.id, session.user.id))

    // Update session
    session.user.avatar = saved.path
    await setUserSession(event, session)

    return { success: true, path: saved.path }
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Upload failed' })
  }
})