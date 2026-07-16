import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'

export const reservedSubdomains = new Set(['www', 'app', 'api', 'admin', 'localhost', 'portal', 'mail', 'smtp', 'ftp'])

export function organizationSlug(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)
}

export function workspaceUrl(baseDomain: string, slug: string) {
  return baseDomain ? `https://${slug}.${baseDomain}` : ''
}

export async function resolveTenantFromHost(event: H3Event) {
  const config = useRuntimeConfig(event)
  const baseDomain = String(config.tenantBaseDomain || '').toLowerCase().trim()
  if (!baseDomain) return null

  const forwardedHost = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '').split(',')[0] || ''
  const host = forwardedHost.trim().toLowerCase().split(':')[0] || ''
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
