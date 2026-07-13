import { eq } from 'drizzle-orm'
import { db, tables } from './database'

const reservedSubdomains = new Set(['www', 'app', 'api', 'admin', 'localhost'])

export async function resolveTenantFromHost(event: H3Event) {
  const config = useRuntimeConfig(event)
  const baseDomain = String(config.tenantBaseDomain || '').toLowerCase().trim()
  if (!baseDomain) return null

  const host = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '').split(',')[0].trim().toLowerCase().split(':')[0]
  if (!host || host === baseDomain || host === `www.${baseDomain}` || host === `app.${baseDomain}`) return null
  if (!host.endsWith(`.${baseDomain}`)) return null

  const slug = host.slice(0, -(baseDomain.length + 1)).split('.')[0]
  if (!slug || reservedSubdomains.has(slug)) return null
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.slug, slug) })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization workspace not found' })
  return organization
}

export function currentTenant(event: H3Event) {
  return event.context.tenant as { id: number, slug: string, name: string } | undefined
}
