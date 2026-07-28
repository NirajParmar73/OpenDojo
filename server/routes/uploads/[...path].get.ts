import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const uploadsRoot = resolve(process.cwd(), 'public', 'uploads')

const contentTypes: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

export default defineEventHandler(async (event) => {
  const relativePath = getRouterParam(event, 'path') || ''
  const filePath = resolve(uploadsRoot, relativePath)

  if (!relativePath || !filePath.startsWith(`${uploadsRoot}${sep}`)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  let fileStat
  try {
    fileStat = await stat(filePath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  if (!fileStat.isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  setResponseHeader(event, 'Content-Type', contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream')
  setResponseHeader(event, 'Content-Length', fileStat.size)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return sendStream(event, createReadStream(filePath))
})
