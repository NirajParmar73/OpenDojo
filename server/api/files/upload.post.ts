// server/api/files/upload.post.ts
import { saveUploadedFile } from '../../../server/utils/upload'

export default defineEventHandler(async (event) => {
  // Must be authenticated
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  // Expect fields: file (file data) and type (string: 'avatar' or 'logo')
  const filePart = formData.find((part) => part.name === 'file')
  const typePart = formData.find((part) => part.name === 'type')

  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }
  if (!typePart || !typePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing type field' })
  }

  const type = typePart.data.toString()
  if (!['avatar', 'logo'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid type. Must be "avatar" or "logo".' })
  }

  // Optionally, you can restrict to a specific organization role for logo uploads
  // But we'll let the frontend handle permission checks.

  try {
    const savedFile = await saveUploadedFile(
      {
        name: filePart.filename || 'file',
        data: filePart.data,
        filename: filePart.filename || 'file',
        type: filePart.type,
      },
      type === 'avatar' ? 'avatars' : 'logos'
    )

    return {
      success: true,
      path: savedFile.path,
      filename: savedFile.filename,
      size: savedFile.size,
    }
  } catch (error: any) {
    throw createError({ statusCode: 400, statusMessage: error.message || 'Upload failed' })
  }
})