export default defineNuxtRouteMiddleware(async () => {
  const { user, ready, fetch } = useUserSession()
  if (!ready.value) await fetch()
  if (!user.value?.isPlatformAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Platform administrator access required' })
  }
})
