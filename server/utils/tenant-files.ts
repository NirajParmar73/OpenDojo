import { unlink } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const uploadsRoot = resolve(process.cwd(), 'public', 'uploads')

/** Removes only application-managed files below public/uploads. */
export async function removeTenantUploads(paths: Array<string | null | undefined>) {
  const uniquePaths = [...new Set(paths.filter((value): value is string => !!value && value.startsWith('/uploads/')))]
  const outcomes = await Promise.allSettled(uniquePaths.map(async (relativePath) => {
    const absolutePath = resolve(process.cwd(), 'public', `.${relativePath}`)
    if (!absolutePath.startsWith(`${uploadsRoot}${sep}`)) return
    await unlink(absolutePath)
  }))
  return outcomes.filter(result => result.status === 'rejected').length
}
