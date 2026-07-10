// server/utils/upload.ts
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

export interface UploadedFile {
  name: string  // original filename
  data: Buffer
  filename: string  // new unique filename on disk
  path: string      // relative path from /public (e.g., /uploads/avatars/xxx.jpg)
  size: number
  type: string      // mime type
}

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const maxFileSize = 5 * 1024 * 1024 // 5MB

/**
 * Saves a multipart file to the public uploads folder.
 * Returns the saved file info.
 */
export async function saveUploadedFile(
  filePart: { name: string; data: Buffer; filename: string; type?: string },
  subfolder: string // e.g., 'avatars' or 'logos'
): Promise<UploadedFile> {
  // Validate file type
  if (!allowedImageTypes.includes(filePart.type ?? '')) {
    throw new Error('Invalid file type. Only images are allowed.')
  }

  // Validate file size
  if (filePart.data.byteLength > maxFileSize) {
    throw new Error('File too large. Max 5MB.')
  }

  // Generate unique filename
  const ext = extname(filePart.filename) || '.jpg'
  const uniqueName = `${randomUUID()}${ext}`
  const relativePath = `/uploads/${subfolder}/${uniqueName}`
  const absolutePath = join(process.cwd(), 'public', relativePath)

  // Ensure directory exists
  const dir = join(process.cwd(), 'public', 'uploads', subfolder)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  // Write file
  await writeFile(absolutePath, filePart.data)

  return {
    name: filePart.filename,
    data: filePart.data,
    filename: uniqueName,
    path: relativePath,
    size: filePart.data.byteLength,
    type: filePart.type || 'application/octet-stream',
  }
}