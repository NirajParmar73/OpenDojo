import { saveUploadedFile } from '../../server/utils/upload'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
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
    return { success: true, path: saved.path }
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Upload failed' })
  }
})