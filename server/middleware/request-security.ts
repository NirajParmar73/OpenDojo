import { randomUUID } from 'node:crypto'
import { isTrustedWorkspaceLoginHandoff } from '#shared/utils/app-host'

type RateBucket = { count: number, resetAt: number }

const buckets = new Map<string, RateBucket>()
const authenticationPaths = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/resend-verification',
  '/api/portal/login',
  '/api/onboarding',
  '/api/account-deletion-requests',
])

function clientAddress(event: any) {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

function enforceRateLimit(event: any, limit: number, windowMs: number) {
  const now = Date.now()
  const key = `${clientAddress(event)}:${event.path.split('?')[0]}`
  const current = buckets.get(key)
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current
  bucket.count += 1
  buckets.set(key, bucket)

  setResponseHeader(event, 'X-RateLimit-Limit', String(limit))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)))
  setResponseHeader(event, 'X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))
  if (bucket.count > limit) {
    setResponseHeader(event, 'Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please wait and try again.' })
  }
}

export default defineEventHandler((event) => {
  const requestId = getRequestHeader(event, 'x-request-id')?.slice(0, 100) || randomUUID()
  event.context.requestId = requestId
  setResponseHeader(event, 'X-Request-Id', requestId)

  if (!event.path.startsWith('/api/')) return
  const pathname = event.path.split('?')[0] || event.path
  if (authenticationPaths.has(pathname) || (['/api/public/admissions', '/api/public/existing-student-registrations'].includes(pathname) && event.method === 'POST')) enforceRateLimit(event, 10, 15 * 60 * 1000)
  else if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) enforceRateLimit(event, 120, 60 * 1000)

  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) {
    const origin = getRequestHeader(event, 'origin')
    const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host')
    if (origin && host) {
      const parsedOrigin = (() => {
        try {
          return new URL(origin)
        } catch {
          throw createError({ statusCode: 403, statusMessage: 'Invalid request origin.' })
        }
      })()
      const config = useRuntimeConfig(event)
      const trustedWorkspaceLogin = pathname === '/api/auth/login'
        && parsedOrigin.protocol === 'https:'
        && isTrustedWorkspaceLoginHandoff(
          parsedOrigin.hostname,
          host,
          String(config.tenantBaseDomain || '')
        )
      if (parsedOrigin.host !== host && !trustedWorkspaceLogin) {
        throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked.' })
      }
    }
  }

  if (buckets.size > 10_000) {
    const now = Date.now()
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
  }
})
