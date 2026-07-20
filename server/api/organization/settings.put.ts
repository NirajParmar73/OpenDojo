import { db, tables } from '../../utils/database'
import { eq } from 'drizzle-orm'
import { saveUploadedFile } from '../../utils/upload'
import { organizationSlug, reservedSubdomains } from '../../utils/tenant'

export default defineEventHandler(async (event) => {
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

  // 🔍 Debug: log all parts
  console.log('📦 Form parts:', form.map(p => ({ name: p.name, type: p.type, filename: p.filename, dataLength: p.data?.length })))

  // ✅ Extract fields more robustly: find part by name, regardless of type
  const getField = (name: string): string | null => {
    const part = form.find((p) => p.name === name)
    return part ? part.data.toString() : null
  }

  const name = getField('name')
  const requestedSlug = getField('slug')
  const currency = getField('currency')
  const logoFilePart = form.find((p) => p.name === 'logo' && p.filename)

  const updateData: any = {}
  if (name !== null) updateData.name = name
  if (requestedSlug !== null) {
    const slug = organizationSlug(requestedSlug)
    if (!slug || reservedSubdomains.has(slug)) throw createError({ statusCode: 400, statusMessage: 'Choose a different workspace address' })
    const conflict = await db.query.organizations.findFirst({ where: eq(tables.organizations.slug, slug), columns: { id: true } })
    if (conflict && conflict.id !== session.user.organizationId) throw createError({ statusCode: 409, statusMessage: 'That workspace address is already taken' })
    updateData.slug = slug
  }
  if (currency !== null) {
    const supportedCurrencies = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'INR', 'SGD', 'AED', 'ZAR', 'BRL', 'MXN'])
    if (!supportedCurrencies.has(currency)) throw createError({ statusCode: 400, statusMessage: 'Choose a supported currency' })
    updateData.currency = currency
  }
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

  // Update session
  session.user.organizationName = updated.name
  session.user.organizationLogo = updated.logo
  await setUserSession(event, session)

  return {
    success: true,
    organization: { id: updated.id, name: updated.name, slug: updated.slug, logo: updated.logo, currency: updated.currency },
  }
})
