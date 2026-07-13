import { resolveTenantFromHost } from '../utils/tenant'

export default defineEventHandler(async event => {
  const tenant = await resolveTenantFromHost(event)
  if (tenant) event.context.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name }

  const session = await getUserSession(event)
  if (tenant && session?.user?.organizationId && session.user.organizationId !== tenant.id) {
    throw createError({ statusCode: 403, statusMessage: 'This account does not belong to the requested organization workspace' })
  }
})
