export default defineNuxtRouteMiddleware(async () => {
  const { user, loggedIn, ready, fetch } = useUserSession()
  if (!ready.value) await fetch()
  if (!loggedIn.value) return navigateTo('/auth/login')
  if (!user.value?.isPlatformAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Platform administrator access required' })
  }
})
