import { classifyAppHost, portalAppUrl } from '#shared/utils/app-host'

export default defineNuxtRouteMiddleware(async () => {
    const session = useUserSession()

    // On client-side navigation the session plugin may still be hydrating.
    // Refresh it once before deciding that the user is signed out; otherwise
    // a valid platform session can be redirected to login intermittently.
    if (!session.ready.value) {
        await session.fetch()
    }
    if (!session.loggedIn.value) {
        return navigateTo('/auth/login')
    }
    if (session.user.value?.role === 'student') {
        const config = useRuntimeConfig()
        const host = classifyAppHost(useRequestURL().hostname, String(config.public.tenantBaseDomain || ''))
        const target = host.surface === 'legacy'
            ? '/portal'
            : portalAppUrl(String(config.public.tenantBaseDomain || ''), host.tenantSlug)
        return navigateTo(target, { external: target.startsWith('http') })
    }
})
