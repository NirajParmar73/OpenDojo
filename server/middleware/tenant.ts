import { platformAppUrl, portalAppUrl, staffAppUrl } from '#shared/utils/app-host'
import { requestAppHost, resolveTenantFromHost } from '../utils/tenant'

export default defineEventHandler(async event => {
  const appHost = requestAppHost(event)
  event.context.appSurface = appHost.surface
  event.context.tenantSlug = appHost.tenantSlug

  const tenant = await resolveTenantFromHost(event)
  if (tenant) event.context.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name }

  const session = await getUserSession(event)
  if (tenant && session?.user?.organizationId && session.user.organizationId !== tenant.id) {
    throw createError({ statusCode: 403, statusMessage: 'This account does not belong to the requested organization workspace' })
  }

  const config = useRuntimeConfig(event)
  if (!config.enforceAppSubdomains || appHost.surface === 'legacy') return

  const pathname = event.path.split('?')[0] || '/'
  const isApi = pathname.startsWith('/api/')
  const acceptsHtml = !isApi && (getRequestHeader(event, 'accept') || '').includes('text/html')

  if (isApi) {
    if (pathname.startsWith('/api/platform/') && appHost.surface !== 'platform') {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    if (pathname.startsWith('/api/portal/') && appHost.surface !== 'portal') {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    if (pathname === '/api/auth/login' && !['staff', 'platform'].includes(appHost.surface)) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    if (appHost.surface === 'platform') {
      const platformApi = pathname.startsWith('/api/platform/')
      const platformAuthApi = pathname === '/api/auth/login' || pathname === '/api/auth/logout' || pathname === '/api/_auth/session'
      if (!platformApi && !platformAuthApi) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
  }

  if (!acceptsHtml) return

  const baseDomain = String(config.tenantBaseDomain || '')
  if (appHost.surface === 'public' && pathname === '/auth/login') {
    return sendRedirect(event, staffAppUrl(baseDomain, `/auth/login${event.path.includes('?') ? `?${event.path.split('?')[1]}` : ''}`))
  }
  if (appHost.surface === 'public' && pathname.startsWith('/portal')) {
    return sendRedirect(event, portalAppUrl(baseDomain, null, pathname))
  }
  if (appHost.surface === 'portal' && !pathname.startsWith('/portal')) {
    return sendRedirect(event, portalAppUrl(baseDomain, appHost.tenantSlug))
  }
  if (appHost.surface === 'platform' && !pathname.startsWith('/platform') && !pathname.startsWith('/auth/')) {
    return sendRedirect(event, session?.user?.isPlatformAdmin ? '/platform' : '/auth/login')
  }
  if (appHost.surface === 'staff' && pathname.startsWith('/portal')) {
    return sendRedirect(event, portalAppUrl(baseDomain, appHost.tenantSlug, pathname))
  }
  if (appHost.surface !== 'platform' && pathname.startsWith('/platform')) {
    return sendRedirect(event, platformAppUrl(baseDomain, pathname))
  }

  if (session?.user?.role === 'student' && appHost.surface !== 'portal') {
    return sendRedirect(event, portalAppUrl(baseDomain, appHost.tenantSlug))
  }
  if (session?.user?.role && session.user.role !== 'student' && appHost.surface === 'portal' && pathname !== '/portal/login') {
    return sendRedirect(event, '/portal/login')
  }
})
