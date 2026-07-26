import { db, tables } from '../../../../server/utils/database'
import { eq, and } from 'drizzle-orm'
import { saveUploadedFile } from '../../../../server/utils/upload'
import { canEditManagedUser, getAllowedAssignmentsForCreator } from '../../../utils/permissions'

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

  // Check user exists
  const user = await db.query.users.findFirst({
    where: and(
      eq(tables.users.id, Number(id)),
      eq(tables.users.organizationId, orgId)
    ),
    with: { assignments: true },
  })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  const allowed = await getAllowedAssignmentsForCreator(session.user.id, orgId)
  if (!canEditManagedUser(session.user.id, session.user.role, user, allowed)) {
    throw createError({ statusCode: 403, statusMessage: 'This user is not a lower-level member entirely within your territory' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const filePart = form.find((p) => p.name === 'certificate' && p.filename)
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'Missing certificate file' })
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
