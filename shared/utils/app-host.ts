export type AppSurface = 'legacy' | 'public' | 'platform' | 'staff' | 'portal'

export type AppHostContext = {
  surface: AppSurface
  tenantSlug: string | null
}

const baseReservedSubdomains = new Set(['www', 'app', 'api', 'admin', 'platform', 'portal', 'mail', 'smtp', 'ftp'])

function normalizedHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '').split(':')[0] || ''
}

function normalizedBaseDomain(value: string) {
  return normalizedHostname(value).replace(/^\.+/, '')
}

function isSingleHostnameLabel(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
}

export function classifyAppHost(hostname: string, configuredBaseDomain: string): AppHostContext {
  const host = normalizedHostname(hostname)
  const baseDomain = normalizedBaseDomain(configuredBaseDomain)
  if (!host || !baseDomain) return { surface: 'legacy', tenantSlug: null }

  if (host === baseDomain || host === `www.${baseDomain}`) return { surface: 'public', tenantSlug: null }
  if (host === `platform.${baseDomain}`) return { surface: 'platform', tenantSlug: null }
  if (host === `app.${baseDomain}`) return { surface: 'staff', tenantSlug: null }
  if (host === `portal.${baseDomain}`) return { surface: 'portal', tenantSlug: null }

  const portalSuffix = `.portal.${baseDomain}`
  if (host.endsWith(portalSuffix)) {
    const tenantSlug = host.slice(0, -portalSuffix.length)
    if (isSingleHostnameLabel(tenantSlug) && !baseReservedSubdomains.has(tenantSlug)) {
      return { surface: 'portal', tenantSlug }
    }
    return { surface: 'public', tenantSlug: null }
  }

  const tenantSuffix = `.${baseDomain}`
  if (host.endsWith(tenantSuffix)) {
    const tenantSlug = host.slice(0, -tenantSuffix.length)
    if (isSingleHostnameLabel(tenantSlug) && !baseReservedSubdomains.has(tenantSlug)) {
      return { surface: 'staff', tenantSlug }
    }
  }

  return { surface: 'public', tenantSlug: null }
}

export function staffAppUrl(baseDomain: string, path = '/') {
  const base = normalizedBaseDomain(baseDomain)
  return base ? `https://app.${base}${path}` : path
}

export function platformAppUrl(baseDomain: string, path = '/platform') {
  const base = normalizedBaseDomain(baseDomain)
  return base ? `https://platform.${base}${path}` : path
}

export function tenantStaffUrl(baseDomain: string, tenantSlug: string, path = '/') {
  const base = normalizedBaseDomain(baseDomain)
  return base && isSingleHostnameLabel(tenantSlug) ? `https://${tenantSlug}.${base}${path}` : path
}

export function portalAppUrl(baseDomain: string, tenantSlug?: string | null, path = '/portal') {
  const base = normalizedBaseDomain(baseDomain)
  if (!base) return path
  const prefix = tenantSlug && isSingleHostnameLabel(tenantSlug) ? `${tenantSlug}.portal` : 'portal'
  return `https://${prefix}.${base}${path}`
}

export function appReservedSubdomains() {
  return new Set(baseReservedSubdomains)
}
