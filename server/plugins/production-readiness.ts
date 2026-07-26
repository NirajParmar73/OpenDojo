export default defineNitroPlugin((nitroApp) => {
  if (process.env.NODE_ENV === 'production') {
    const problems: string[] = []
    const sessionPassword = process.env.NUXT_SESSION_PASSWORD || ''
    const appUrl = process.env.NUXT_PUBLIC_APP_URL || ''

    if (sessionPassword.length < 32) problems.push('NUXT_SESSION_PASSWORD must contain at least 32 characters')
    const secureAppUrl = (() => {
      try {
        const parsedAppUrl = new URL(appUrl)
        return parsedAppUrl.protocol === 'https:' || ['localhost', '127.0.0.1', '::1'].includes(parsedAppUrl.hostname)
      } catch {
        return false
      }
    })()
    if (!secureAppUrl) problems.push('NUXT_PUBLIC_APP_URL must use HTTPS (except for local smoke tests)')
    if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is required')
    if (Boolean(process.env.NUXT_RAZORPAY_KEY_ID) !== Boolean(process.env.NUXT_RAZORPAY_KEY_SECRET)) {
      problems.push('NUXT_RAZORPAY_KEY_ID and NUXT_RAZORPAY_KEY_SECRET must be configured together')
    }
    if (problems.length) throw new Error(`Production configuration is invalid:\n- ${problems.join('\n- ')}`)
  }

  nitroApp.hooks.hook('error', (error, context) => {
    const event = context.event
    const statusCode = (error as { statusCode?: number }).statusCode || 500
    const log = statusCode >= 500 ? console.error : console.warn
    log(JSON.stringify({
      level: statusCode >= 500 ? 'error' : 'warn',
      requestId: event?.context.requestId,
      method: event?.method,
      path: event?.path,
      statusCode,
      message: error.message,
      timestamp: new Date().toISOString(),
    }))
  })
})
