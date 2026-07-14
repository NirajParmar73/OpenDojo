export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  if (!user.value?.isPlatformAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Platform administrator access required' })
  }
})
