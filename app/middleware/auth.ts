export default defineNuxtRouteMiddleware(async ()=>{
    const session = useUserSession()

    if (!session.loggedIn.value) {
        return navigateTo('/auth/login')
    }
})