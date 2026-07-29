import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db, tables } from './database'
import { appReservedSubdomains, classifyAppHost, tenantStaffUrl, type AppSurface } from '#shared/utils/app-host'

export const reservedSubdomains = new Set([...appReservedSubdomains(), 'localhost'])

export function organizationSlug(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)
}

export function workspaceUrl(baseDomain: string, slug: string) {
  return baseDomain ? tenantStaffUrl(baseDomain, slug) : ''
}

function requestHostname(event: H3Event) {
  const forwardedHost = (getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || '').split(',')[0] || ''
  return forwardedHost.trim().toLowerCase().split(':')[0] || ''
}

export function requestAppHost(event: H3Event) {
  const config = useRuntimeConfig(event)
  const baseDomain = String(config.tenantBaseDomain || '').toLowerCase().trim()
  return classifyAppHost(requestHostname(event), baseDomain)
}

export async function resolveTenantFromHost(event: H3Event) {
  const host = requestAppHost(event)
  if (!host.tenantSlug) return null
  const organization = await db.query.organizations.findFirst({ where: eq(tables.organizations.slug, host.tenantSlug) })
  if (!organization) throw createError({ statusCode: 404, statusMessage: 'Organization workspace not found' })
  return organization
}

export function currentTenant(event: H3Event) {
  return event.context.tenant as { id: number, slug: string, name: string } | undefined
}

export function currentAppSurface(event: H3Event) {
  return (event.context.appSurface || 'legacy') as AppSurface
}
