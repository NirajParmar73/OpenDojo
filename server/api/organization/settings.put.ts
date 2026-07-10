// server/api/organization/settings.put.ts
import { db, tables } from '../../../server/utils/database' // use alias for consistency
import { eq } from 'drizzle-orm'
import { saveUploadedFile } from '../../../server/utils/upload'

export default defineEventHandler(async (event) => {
  // ✅ Declare session once
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (session.user.role !== 'owner') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const form = await readMultipartFormData(event)
  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid form data' })
  }

  const getField = (name: string): string | null => {
    const part = form.find((p) => p.name === name && p.type === 'text')
    return part ? part.data.toString() : null
  }

  const name = getField('name')
  const logoFilePart = form.find((p) => p.name === 'logo' && p.filename)

  const updateData: any = {}
  if (name) updateData.name = name
  if (logoFilePart && logoFilePart.data) {
    try {
      const saved = await saveUploadedFile(
        {
          name: logoFilePart.filename || 'logo',
          data: logoFilePart.data,
          filename: logoFilePart.filename || 'logo',
          type: logoFilePart.type || 'image/jpeg',
        },
        'logos'
      )
      updateData.logo = saved.path
    } catch (err: any) {
      throw createError({ statusCode: 400, statusMessage: err.message || 'Logo upload failed' })
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const [updated] = await db.update(tables.organizations)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(tables.organizations.id, session.user.organizationId!))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update organization' })
  }

  // ✅ Update session with new data
  session.user.organizationName = updated.name
  session.user.organizationLogo = updated.logo
  await setUserSession(event, session)

  return {
    success: true,
    organization: { id: updated.id, name: updated.name, slug: updated.slug, logo: updated.logo },
  }
})