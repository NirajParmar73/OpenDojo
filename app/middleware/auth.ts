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
})
